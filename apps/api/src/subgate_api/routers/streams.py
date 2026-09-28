from datetime import UTC, datetime
from uuid import UUID, uuid4

import os

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from subgate_api.db import get_session
from subgate_api.dependencies.auth import get_current_creator
from subgate_api.models import Creator, Payment, PlaybackToken, Stream, ViewingSession
from subgate_api.schemas import (
    CreateStreamRequest,
    HeartbeatRequest,
    PlaybackTokenResponse,
    RegisterStreamOnchainRequest,
    ReceiptResponse,
    SessionResponse,
    StartSessionRequest,
    StopSessionRequest,
    StreamResponse,
    UpdateStreamRequest,
)
from subgate_api.services.settlement import (
    CircleGatewaySettlement,
    LocalSettlementGateway,
    PaymentRequirement,
    SettlementResult,
    encode_payment_requirement,
)
from subgate_api.services.playback import issue_token, parse_token, token_hash
from subgate_api.services.auth import normalize_wallet
from subgate_api.services.streaming import billable_seconds, metered_amount, now_utc
from subgate_api.services.arbitrum import (
    ArbitrumConfigurationError,
    ArbitrumRpcError,
    ArbitrumVerificationError,
    chain_readiness,
    chain_id as configured_chain_id,
    public_chain_config,
    stream_id_bytes32,
    verify_pay_per_view_settlement,
    verify_stream_registration,
)

router = APIRouter(tags=["streams"])
settlement_gateway = LocalSettlementGateway()
MAX_HEARTBEAT_INTERVAL_SECONDS = 30
STOP_GRACE_SECONDS = 5


def settlement_mode() -> str:
    return os.getenv("SUBGATE_SETTLEMENT_MODE", "arbitrum").strip().lower()


def required_arbitrum_config() -> dict[str, object]:
    try:
        config = public_chain_config(required=True)
    except ArbitrumConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    assert config is not None
    return config


@router.get("/chain/status", response_model=None)
async def get_chain_status() -> dict[str, object] | JSONResponse:
    mode = settlement_mode()
    if mode == "local":
        return {"ready": False, "mode": "local", "message": "Local simulation is enabled; payments are not real or on-chain."}
    if mode != "arbitrum":
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"ready": False, "mode": mode, "message": "No supported settlement adapter is enabled."})
    try:
        return await chain_readiness()
    except (ArbitrumConfigurationError, ArbitrumRpcError, ArbitrumVerificationError) as error:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"ready": False, "mode": mode, "message": str(error)})


def payment_requirement(
    request: Request,
    stream: Stream,
    amount_atomic: int,
    *,
    description: str | None = None,
) -> PaymentRequirement:
    return PaymentRequirement(
        resource_url=str(request.url),
        description=description or f"Watch Subgate stream: {stream.title}",
        network=os.getenv("X402_NETWORK", "eip155:421614"),
        asset=(
            os.getenv("USDC_ADDRESS")
            or os.getenv("X402_ASSET")
            or "0x0000000000000000000000000000000000000000"
        ),
        amount_atomic=amount_atomic,
        pay_to=stream.creator.wallet_address,
        gateway_wallet=os.getenv(
            "X402_GATEWAY_WALLET_ADDRESS",
            "0x0000000000000000000000000000000000000000",
        ),
        max_timeout_seconds=int(os.getenv("X402_MAX_TIMEOUT_SECONDS", "300")),
    )


def payment_required_response(requirement: PaymentRequirement, detail: str = "Payment required") -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        content={"message": detail, "payment_required": requirement.as_dict()},
        headers={"PAYMENT-REQUIRED": encode_payment_requirement(requirement)},
    )


async def circle_settle(
    payment_signature: str,
    requirement: PaymentRequirement,
) -> SettlementResult:
    facilitator_url = os.getenv("X402_FACILITATOR_URL", "https://gateway-api-testnet.circle.com")
    gateway = CircleGatewaySettlement(facilitator_url, api_key=os.getenv("CIRCLE_API_KEY") or None)
    return await gateway.settle(payment_signature, requirement)


def validate_payer(result: SettlementResult, viewer_wallet: str) -> None:
    if result.payer_address and result.payer_address.lower() != viewer_wallet.lower():
        raise ValueError("PAYMENT-SIGNATURE payer does not match viewer wallet")


def stream_response(stream: Stream) -> StreamResponse:
    return StreamResponse(
        id=stream.id,
        creator_wallet=stream.creator.wallet_address,
        creator_display_name=stream.creator.display_name,
        slug=stream.slug,
        title=stream.title,
        description=stream.description,
        stream_type=stream.stream_type,
        pricing={
            "model": stream.pricing_model,
            "price_atomic": stream.price_atomic,
            "rate_atomic_per_minute": stream.rate_atomic_per_minute,
        },
        free_preview_seconds=stream.free_preview_seconds,
        playback_url=stream.playback_url,
        is_published=stream.is_published,
        chain=public_chain_config() if settlement_mode() == "arbitrum" else None,
        chain_stream_id=stream.chain_stream_id,
        registry_transaction_hash=stream.registry_tx_hash,
        created_at=stream.created_at,
    )


def session_response(session: ViewingSession, settlement_tx_hash: str | None = None) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        stream_id=session.stream_id,
        viewer_wallet=session.viewer_wallet,
        status=session.status,
        max_spend_atomic=session.max_spend_atomic,
        consumed_seconds=session.consumed_seconds,
        accrued_atomic=session.accrued_atomic,
        settled_atomic=session.settled_atomic,
        started_at=session.started_at,
        last_heartbeat_at=session.last_heartbeat_at,
        ended_at=session.ended_at,
        settlement_tx_hash=settlement_tx_hash,
    )


async def load_stream(session: AsyncSession, stream_id: UUID) -> Stream:
    result = await session.execute(
        select(Stream).options(selectinload(Stream.creator)).where(Stream.id == stream_id)
    )
    stream = result.scalar_one_or_none()
    if stream is None or not stream.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    if settlement_mode() == "arbitrum" and (stream.chain_id != configured_chain_id() or not stream.registry_tx_hash):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream is not available on the configured Arbitrum chain")
    return stream


async def load_creator_stream(session: AsyncSession, creator: Creator, stream_id: UUID) -> Stream:
    result = await session.execute(
        select(Stream)
        .options(selectinload(Stream.creator))
        .where(Stream.id == stream_id, Stream.creator_id == creator.id)
    )
    stream = result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    return stream


async def load_session(session: AsyncSession, session_id: UUID) -> ViewingSession:
    result = await session.execute(select(ViewingSession).where(ViewingSession.id == session_id))
    viewing_session = result.scalar_one_or_none()
    if viewing_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Viewing session not found")
    return viewing_session


async def settle_metered_session(
    session: AsyncSession,
    viewing_session: ViewingSession,
    ended_at,
    settlement: SettlementResult | None = None,
) -> None:
    result = settlement or await settlement_gateway.settle(viewing_session.id, viewing_session.accrued_atomic)
    viewing_session.status = "completed"
    viewing_session.settled_atomic = viewing_session.accrued_atomic
    viewing_session.ended_at = ended_at
    await session.execute(
        update(PlaybackToken)
        .where(PlaybackToken.session_id == viewing_session.id, PlaybackToken.revoked_at.is_(None))
        .values(revoked_at=ended_at)
    )
    session.add(
        Payment(
            session_id=viewing_session.id,
            amount_atomic=viewing_session.accrued_atomic,
            transaction_reference=result.transaction_reference,
        )
    )


@router.get("/streams", response_model=list[StreamResponse])
async def list_streams(session: AsyncSession = Depends(get_session)) -> list[StreamResponse]:
    conditions = [Stream.is_published.is_(True)]
    if settlement_mode() == "arbitrum":
        conditions.extend([Stream.chain_id == configured_chain_id(), Stream.registry_tx_hash.is_not(None)])
    result = await session.execute(
        select(Stream)
        .options(selectinload(Stream.creator))
        .where(*conditions)
        .order_by(Stream.created_at.desc())
    )
    return [stream_response(stream) for stream in result.scalars()]


@router.get("/streams/{slug}", response_model=StreamResponse)
async def get_stream(slug: str, session: AsyncSession = Depends(get_session)) -> StreamResponse:
    conditions = [Stream.slug == slug, Stream.is_published.is_(True)]
    if settlement_mode() == "arbitrum":
        conditions.extend([Stream.chain_id == configured_chain_id(), Stream.registry_tx_hash.is_not(None)])
    result = await session.execute(
        select(Stream).options(selectinload(Stream.creator)).where(*conditions)
    )
    stream = result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    return stream_response(stream)


@router.get("/streams/{slug}/payment-requirement")
async def get_payment_requirement(
    slug: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    conditions = [Stream.slug == slug, Stream.is_published.is_(True)]
    if settlement_mode() == "arbitrum":
        conditions.extend([Stream.chain_id == configured_chain_id(), Stream.registry_tx_hash.is_not(None)])
    result = await session.execute(select(Stream).options(selectinload(Stream.creator)).where(*conditions))
    stream = result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    if stream.pricing_model != "pay_per_view" or stream.price_atomic is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pay-per-view streams have an upfront payment requirement")

    if settlement_mode() == "arbitrum":
        chain = required_arbitrum_config()
        return {
            "chain": chain,
            "payment_required": {
                "chain_id": chain["chain_id"],
                "network": chain["network"],
                "payment_token_address": chain["payment_token_address"],
                "receipts_contract_address": chain["receipts_contract_address"],
                "stream_id": stream.chain_stream_id or stream_id_bytes32(stream.id),
                "creator_wallet": stream.creator.wallet_address,
                "amount_atomic": stream.price_atomic,
                "amount_usdc": f"{stream.price_atomic / 1_000_000:.6f}",
            },
        }

    requirement = payment_requirement(request, stream, stream.price_atomic)
    return {
        "payment_required": requirement.as_dict(),
        "payment_required_header": encode_payment_requirement(requirement),
    }


@router.get("/creator/streams", response_model=list[StreamResponse])
async def list_creator_streams(
    creator: Creator = Depends(get_current_creator),
    session: AsyncSession = Depends(get_session),
) -> list[StreamResponse]:
    result = await session.execute(
        select(Stream)
        .options(selectinload(Stream.creator))
        .where(Stream.creator_id == creator.id)
        .order_by(Stream.created_at.desc())
    )
    return [stream_response(stream) for stream in result.scalars()]


@router.post("/streams", response_model=StreamResponse, status_code=status.HTTP_201_CREATED)
async def create_stream(
    payload: CreateStreamRequest,
    creator: Creator = Depends(get_current_creator),
    session: AsyncSession = Depends(get_session),
) -> StreamResponse:
    if creator.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Creator account must be approved before publishing streams",
        )
    if not creator.wallet_address:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Link a wallet before creating a stream",
        )
    try:
        requested_wallet = normalize_wallet(payload.creator_wallet)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    if requested_wallet != creator.wallet_address:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Creator wallet does not match authenticated wallet")

    existing = await session.scalar(select(Stream.id).where(Stream.slug == payload.slug))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A stream already uses this slug")

    stream_id = uuid4()
    is_arbitrum = settlement_mode() == "arbitrum"
    chain = required_arbitrum_config() if is_arbitrum else None
    stream = Stream(
        id=stream_id,
        creator_id=creator.id,
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        stream_type=payload.stream_type,
        pricing_model=payload.pricing.model,
        price_atomic=payload.pricing.price_atomic,
        rate_atomic_per_minute=payload.pricing.rate_atomic_per_minute,
        free_preview_seconds=payload.free_preview_seconds,
        playback_url=str(payload.playback_url),
        # Do not expose a paid stream until its registry transaction has been verified.
        is_published=False if is_arbitrum else payload.is_published,
        chain_id=int(chain["chain_id"]) if chain else None,
        chain_stream_id=stream_id_bytes32(stream_id) if chain else None,
    )
    session.add(stream)
    await session.commit()
    await session.refresh(stream, attribute_names=["creator"])
    return stream_response(stream)


@router.post("/creator/streams/{stream_id}/chain-registration", response_model=StreamResponse)
async def confirm_stream_registration(
    stream_id: UUID,
    payload: RegisterStreamOnchainRequest,
    creator: Creator = Depends(get_current_creator),
    session: AsyncSession = Depends(get_session),
) -> StreamResponse:
    if settlement_mode() != "arbitrum":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Arbitrum registration is not enabled")
    stream = await load_creator_stream(session, creator, stream_id)
    if stream.chain_stream_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This stream has no Arbitrum stream ID")
    if stream.registry_tx_hash:
        if stream.registry_tx_hash.lower() == payload.transaction_hash.lower():
            return stream_response(stream)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A registry transaction is already linked to this stream")

    amount_atomic = stream.price_atomic if stream.pricing_model == "pay_per_view" else stream.rate_atomic_per_minute
    if amount_atomic is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The stream has no valid price to register")
    try:
        await verify_stream_registration(
            payload.transaction_hash,
            expected_stream_id=stream.chain_stream_id,
            expected_creator=creator.wallet_address or "",
            expected_pricing_model=stream.pricing_model,
            expected_price_atomic=amount_atomic,
            expected_preview_seconds=stream.free_preview_seconds,
        )
    except ArbitrumConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except ArbitrumRpcError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except ArbitrumVerificationError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    stream.chain_id = configured_chain_id()
    stream.registry_tx_hash = payload.transaction_hash.lower()
    stream.is_published = payload.publish and creator.approval_status == "approved"
    await session.commit()
    await session.refresh(stream, attribute_names=["creator"])
    return stream_response(stream)


@router.patch("/creator/streams/{stream_id}", response_model=StreamResponse)
async def update_creator_stream(
    stream_id: UUID,
    payload: UpdateStreamRequest,
    creator: Creator = Depends(get_current_creator),
    session: AsyncSession = Depends(get_session),
) -> StreamResponse:
    stream = await load_creator_stream(session, creator, stream_id)
    updates = payload.model_dump(exclude_unset=True)

    if settlement_mode() == "arbitrum" and stream.registry_tx_hash and (
        payload.pricing is not None or payload.free_preview_seconds is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pricing is registered on-chain. Update the on-chain stream price before changing API pricing.",
        )

    if settlement_mode() == "arbitrum" and updates.get("is_published") is True and not stream.registry_tx_hash:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Register this stream on Arbitrum before publishing it")

    if updates.get("is_published") is True and creator.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Creator account must be approved before publishing streams",
        )

    if "title" in updates:
        stream.title = updates["title"]
    if "description" in updates:
        stream.description = updates["description"]
    if "free_preview_seconds" in updates:
        stream.free_preview_seconds = updates["free_preview_seconds"]
    if "playback_url" in updates:
        stream.playback_url = str(updates["playback_url"])
    if "is_published" in updates:
        stream.is_published = updates["is_published"]
    if payload.pricing is not None:
        stream.pricing_model = payload.pricing.model
        stream.price_atomic = payload.pricing.price_atomic
        stream.rate_atomic_per_minute = payload.pricing.rate_atomic_per_minute

    await session.commit()
    await session.refresh(stream, attribute_names=["creator"])
    return stream_response(stream)


@router.delete("/creator/streams/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unpublish_creator_stream(
    stream_id: UUID,
    creator: Creator = Depends(get_current_creator),
    session: AsyncSession = Depends(get_session),
) -> None:
    stream = await load_creator_stream(session, creator, stream_id)
    stream.is_published = False
    await session.commit()


@router.post("/streams/{stream_id}/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def start_session(
    stream_id: UUID,
    payload: StartSessionRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> SessionResponse | JSONResponse:
    stream = await load_stream(session, stream_id)
    mode = settlement_mode()
    if mode == "arbitrum" and stream.pricing_model != "pay_per_view":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Arbitrum settlement currently supports pay-per-view streams only.",
        )
    if stream.pricing_model == "pay_per_view":
        assert stream.price_atomic is not None
        if payload.max_spend_atomic is not None and payload.max_spend_atomic < stream.price_atomic:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum spend is below the pay-per-view price")

    circle_result: SettlementResult | None = None
    if stream.pricing_model == "pay_per_view" and mode == "arbitrum":
        if not stream.chain_stream_id or not stream.registry_tx_hash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This stream is not registered on Arbitrum")
        if not payload.session_id or not payload.settlement_tx_hash:
            chain = required_arbitrum_config()
            return JSONResponse(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                content={
                    "message": "Pay the listed USDC price on Arbitrum Sepolia before playback can start.",
                    "payment_required": {
                        "chain": chain,
                        "stream_id": stream.chain_stream_id,
                        "creator_wallet": stream.creator.wallet_address,
                        "amount_atomic": stream.price_atomic,
                        "session_id_required": True,
                    },
                },
            )
        try:
            viewer_wallet = normalize_wallet(payload.viewer_wallet)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
        existing_session = await session.scalar(
            select(ViewingSession).where(ViewingSession.id == payload.session_id)
        )
        if existing_session is not None:
            existing_payment = await session.scalar(
                select(Payment).where(Payment.session_id == payload.session_id)
            )
            if (
                existing_payment is None
                or existing_payment.receipt_tx_hash != payload.settlement_tx_hash.lower()
                or existing_session.stream_id != stream.id
                or existing_session.viewer_wallet.lower() != viewer_wallet
                or existing_session.status != "completed"
            ):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That viewing session ID has already been used")
            playback = await create_playback_token(session, existing_session, stream)
            return session_response(existing_session, payload.settlement_tx_hash.lower()).model_copy(
                update={"playback_token": playback.token, "playback_url": playback.playback_url}
            )
        duplicate_payment = await session.scalar(
            select(Payment.id).where(Payment.receipt_tx_hash == payload.settlement_tx_hash.lower())
        )
        if duplicate_payment is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This settlement transaction has already been used")
        try:
            await verify_pay_per_view_settlement(
                payload.settlement_tx_hash,
                expected_session_id=payload.session_id,
                expected_stream_id=stream.chain_stream_id,
                expected_viewer=viewer_wallet,
                expected_creator=stream.creator.wallet_address,
                expected_amount_atomic=stream.price_atomic or 0,
            )
        except ArbitrumConfigurationError as error:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
        except ArbitrumRpcError as error:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
        except ArbitrumVerificationError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

        settled_at = now_utc()
        viewing_session = ViewingSession(
            id=payload.session_id,
            stream_id=stream.id,
            viewer_wallet=viewer_wallet,
            status="completed",
            max_spend_atomic=stream.price_atomic,
            accrued_atomic=stream.price_atomic or 0,
            settled_atomic=stream.price_atomic or 0,
            started_at=settled_at,
            last_heartbeat_at=settled_at,
            ended_at=settled_at,
        )
        session.add(viewing_session)
        session.add(
            Payment(
                session_id=payload.session_id,
                amount_atomic=stream.price_atomic or 0,
                transaction_reference=payload.settlement_tx_hash.lower(),
                chain_id=configured_chain_id(),
                receipt_tx_hash=payload.settlement_tx_hash.lower(),
            )
        )
        await session.commit()
        await session.refresh(viewing_session)
        playback = await create_playback_token(session, viewing_session, stream)
        return session_response(viewing_session, payload.settlement_tx_hash.lower()).model_copy(
            update={"playback_token": playback.token, "playback_url": playback.playback_url}
        )

    if stream.pricing_model == "metered" and mode not in {"local", "circle"}:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="No metered settlement adapter is configured")

    if stream.pricing_model == "pay_per_view" and mode == "circle":
        assert stream.price_atomic is not None
        requirement = payment_requirement(request, stream, stream.price_atomic)
        signature = payload.payment_signature or request.headers.get("PAYMENT-SIGNATURE")
        if not signature:
            return payment_required_response(requirement)
        try:
            circle_result = await circle_settle(signature, requirement)
            validate_payer(circle_result, payload.viewer_wallet)
        except ValueError as error:
            return payment_required_response(requirement, str(error))

    started_at = now_utc()
    viewing_session = ViewingSession(
        stream_id=stream.id,
        viewer_wallet=payload.viewer_wallet,
        max_spend_atomic=payload.max_spend_atomic,
        started_at=started_at,
        last_heartbeat_at=started_at,
    )
    session.add(viewing_session)
    await session.flush()

    if stream.pricing_model == "pay_per_view":
        result = circle_result or await settlement_gateway.settle(viewing_session.id, stream.price_atomic)
        viewing_session.status = "completed"
        viewing_session.accrued_atomic = stream.price_atomic
        viewing_session.settled_atomic = stream.price_atomic
        viewing_session.ended_at = now_utc()
        session.add(Payment(session_id=viewing_session.id, amount_atomic=stream.price_atomic, transaction_reference=result.transaction_reference))

    await session.commit()
    await session.refresh(viewing_session)
    playback = await create_playback_token(session, viewing_session, stream)
    return session_response(viewing_session).model_copy(
        update={"playback_token": playback.token, "playback_url": playback.playback_url}
    )


async def create_playback_token(
    session: AsyncSession,
    viewing_session: ViewingSession,
    stream: Stream,
) -> PlaybackTokenResponse:
    token, claims = issue_token(viewing_session.id, stream.id)
    expires_at = datetime.fromtimestamp(claims.expires_at, tz=UTC)
    session.add(
        PlaybackToken(
            id=claims.token_id,
            session_id=viewing_session.id,
            token_hash=token_hash(token),
            expires_at=expires_at,
        )
    )
    await session.commit()
    return PlaybackTokenResponse(
        session_id=viewing_session.id,
        stream_id=stream.id,
        token=token,
        playback_url=f"/playback/{stream.id}/manifest?token={token}",
        expires_at=expires_at,
    )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session_state(session_id: UUID, session: AsyncSession = Depends(get_session)) -> SessionResponse:
    """Return the current server-side usage state for a viewer session."""
    viewing_session = await load_session(session, session_id)
    return session_response(viewing_session)


@router.post("/sessions/{session_id}/playback-token", response_model=PlaybackTokenResponse)
async def issue_playback_token(session_id: UUID, session: AsyncSession = Depends(get_session)) -> PlaybackTokenResponse:
    viewing_session = await load_session(session, session_id)
    if viewing_session.status not in {"active", "completed"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Viewing session is not playable")
    stream = await load_stream(session, viewing_session.stream_id)
    return await create_playback_token(session, viewing_session, stream)


@router.post("/sessions/{session_id}/heartbeat", response_model=SessionResponse)
async def heartbeat_session(
    session_id: UUID,
    payload: HeartbeatRequest,
    session: AsyncSession = Depends(get_session),
) -> SessionResponse:
    viewing_session = await load_session(session, session_id)
    if viewing_session.status == "completed":
        return session_response(viewing_session)

    stream = await load_stream(session, viewing_session.stream_id)
    if stream.pricing_model != "metered" or stream.rate_atomic_per_minute is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Heartbeats apply only to metered sessions")

    current_time = now_utc()
    if payload.playing:
        elapsed = billable_seconds(
            viewing_session.last_heartbeat_at,
            current_time,
            MAX_HEARTBEAT_INTERVAL_SECONDS,
        )
        if elapsed:
            validated_seconds = viewing_session.consumed_seconds + elapsed
            amount = metered_amount(stream.rate_atomic_per_minute, validated_seconds)
            if viewing_session.max_spend_atomic is not None:
                amount = min(amount, viewing_session.max_spend_atomic)
            viewing_session.consumed_seconds = validated_seconds
            viewing_session.accrued_atomic = amount

    viewing_session.last_heartbeat_at = current_time
    if settlement_mode() == "local" and (
        viewing_session.max_spend_atomic is not None
        and viewing_session.accrued_atomic >= viewing_session.max_spend_atomic
    ):
        await settle_metered_session(session, viewing_session, current_time)

    await session.commit()
    await session.refresh(viewing_session)
    return session_response(viewing_session)


@router.post("/sessions/{session_id}/stop", response_model=SessionResponse)
async def stop_session(
    session_id: UUID,
    request: Request,
    payload: StopSessionRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> SessionResponse | JSONResponse:
    viewing_session = await load_session(session, session_id)
    if viewing_session.status == "completed":
        return session_response(viewing_session)

    stream = await load_stream(session, viewing_session.stream_id)
    if stream.pricing_model != "metered" or stream.rate_atomic_per_minute is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This viewing session cannot be settled")
    if settlement_mode() not in {"local", "circle"}:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="No metered settlement adapter is configured")

    ended_at = now_utc()
    elapsed = billable_seconds(viewing_session.last_heartbeat_at, ended_at, STOP_GRACE_SECONDS)
    duration = max(1, viewing_session.consumed_seconds + elapsed)
    amount = metered_amount(stream.rate_atomic_per_minute, duration)
    if viewing_session.max_spend_atomic is not None:
        amount = min(amount, viewing_session.max_spend_atomic)

    circle_result: SettlementResult | None = None
    if settlement_mode() == "circle":
        requirement = payment_requirement(
            request,
            stream,
            amount,
            description=f"Settle Subgate stream session {viewing_session.id}",
        )
        signature = (payload.payment_signature if payload else None) or request.headers.get("PAYMENT-SIGNATURE")
        if not signature:
            return payment_required_response(requirement)
        try:
            circle_result = await circle_settle(signature, requirement)
            validate_payer(circle_result, viewing_session.viewer_wallet)
        except ValueError as error:
            return payment_required_response(requirement, str(error))

    viewing_session.consumed_seconds = duration
    viewing_session.accrued_atomic = amount
    viewing_session.last_heartbeat_at = ended_at
    await settle_metered_session(session, viewing_session, ended_at, circle_result)
    await session.commit()
    await session.refresh(viewing_session)
    return session_response(viewing_session)


@router.get("/sessions/{session_id}/receipt", response_model=ReceiptResponse)
async def get_receipt(session_id: UUID, session: AsyncSession = Depends(get_session)) -> ReceiptResponse:
    result = await session.execute(
        select(ViewingSession, Payment).join(Payment, Payment.session_id == ViewingSession.id).where(ViewingSession.id == session_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settled receipt not found")
    viewing_session, payment = row
    return ReceiptResponse(
        session_id=viewing_session.id,
        stream_id=viewing_session.stream_id,
        viewer_wallet=viewing_session.viewer_wallet,
        duration_seconds=viewing_session.consumed_seconds,
        amount_atomic=payment.amount_atomic,
        transaction_reference=payment.transaction_reference,
        chain_id=payment.chain_id,
        receipt_tx_hash=payment.receipt_tx_hash,
        settled_at=payment.settled_at,
    )


@router.get("/playback/{stream_id}/manifest")
async def playback_manifest(stream_id: UUID, token: str, session: AsyncSession = Depends(get_session)) -> RedirectResponse:
    try:
        claims = parse_token(token)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error

    if claims.stream_id != stream_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Playback token does not match this stream")

    token_record = await session.scalar(
        select(PlaybackToken).where(
            PlaybackToken.id == claims.token_id,
            PlaybackToken.session_id == claims.session_id,
            PlaybackToken.token_hash == token_hash(token),
            PlaybackToken.revoked_at.is_(None),
        )
    )
    if token_record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Playback token is revoked or unknown")

    viewing_session = await load_session(session, claims.session_id)
    if viewing_session.stream_id != stream_id or viewing_session.status not in {"active", "completed"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewing session has no playback access")

    stream = await load_stream(session, stream_id)
    return RedirectResponse(stream.playback_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
