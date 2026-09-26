import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from subgate_api.db import get_session
from subgate_api.dependencies.auth import AuthContext, get_auth_context
from subgate_api.models import Creator, CreatorAuthChallenge, CreatorSession
from subgate_api.schemas import (
    AuthChallengeRequest,
    AuthChallengeResponse,
    AuthResponse,
    CreatorResponse,
    VerifyCreatorRequest,
)
from subgate_api.services.auth import (
    as_utc,
    challenge_ttl_seconds,
    create_challenge_message,
    issue_session_token,
    normalize_wallet,
    now_utc,
    verify_wallet_signature,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def creator_response(creator: Creator) -> CreatorResponse:
    return CreatorResponse(
        id=creator.id,
        wallet_address=creator.wallet_address,
        display_name=creator.display_name,
        created_at=creator.created_at,
    )


@router.post("/challenge", response_model=AuthChallengeResponse)
async def create_auth_challenge(
    payload: AuthChallengeRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthChallengeResponse:
    try:
        wallet_address = normalize_wallet(payload.wallet_address)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    expires_at = now_utc().replace(microsecond=0) + timedelta(seconds=challenge_ttl_seconds())
    nonce = secrets.token_urlsafe(24)
    message = create_challenge_message(wallet_address, nonce, expires_at)
    challenge = CreatorAuthChallenge(
        wallet_address=wallet_address,
        message=message,
        expires_at=expires_at,
    )
    session.add(challenge)
    await session.commit()
    await session.refresh(challenge)
    return AuthChallengeResponse(
        challenge_id=challenge.id,
        wallet_address=challenge.wallet_address,
        message=challenge.message,
        expires_at=challenge.expires_at,
    )


@router.post("/verify", response_model=AuthResponse)
async def verify_auth_challenge(
    payload: VerifyCreatorRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    try:
        wallet_address = normalize_wallet(payload.wallet_address)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    challenge = await session.scalar(
        select(CreatorAuthChallenge)
        .where(CreatorAuthChallenge.id == payload.challenge_id)
        .with_for_update()
    )
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authentication challenge not found")
    if challenge.used_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Authentication challenge was already used")
    if as_utc(challenge.expires_at) <= now_utc():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Authentication challenge has expired")
    if challenge.wallet_address != wallet_address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge wallet does not match request")
    if not verify_wallet_signature(challenge.message, payload.signature, wallet_address):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wallet signature is invalid")

    creator = await session.scalar(select(Creator).where(Creator.wallet_address == wallet_address))
    if creator is None:
        creator = Creator(wallet_address=wallet_address, display_name=payload.display_name or "Creator")
        session.add(creator)
        await session.flush()
    elif payload.display_name:
        creator.display_name = payload.display_name

    challenge.used_at = now_utc()
    raw_token, token_hash, expires_at = issue_session_token()
    creator_session = CreatorSession(
        creator_id=creator.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(creator_session)
    await session.commit()
    await session.refresh(creator)
    return AuthResponse(
        access_token=raw_token,
        expires_at=expires_at,
        creator=creator_response(creator),
    )


@router.get("/me", response_model=CreatorResponse)
async def get_current_creator(context: AuthContext = Depends(get_auth_context)) -> CreatorResponse:
    return creator_response(context.creator)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> Response:
    context.creator_session.revoked_at = now_utc()
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
