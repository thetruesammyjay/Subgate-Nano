from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from subgate_api.db import get_session
from subgate_api.dependencies.auth import AuthContext, get_auth_context
from subgate_api.models import Creator, Payment, Stream, ViewingSession
from subgate_api.schemas import (
    CreatorProfileUpdateRequest,
    CreatorSettingsResponse,
    CreatorSettingsUpdateRequest,
)
from subgate_api.services.auth import normalize_username
from subgate_api.services.streaming import now_utc


router = APIRouter(prefix="/creator", tags=["creator"])


def _session_item(
    viewing: ViewingSession,
    stream: Stream,
    payment: Payment | None,
) -> dict[str, object]:
    return {
        "id": viewing.id,
        "stream_id": stream.id,
        "stream_title": stream.title,
        "stream_slug": stream.slug,
        "viewer_wallet": viewing.viewer_wallet,
        "status": viewing.status,
        "consumed_seconds": viewing.consumed_seconds,
        "accrued_atomic": viewing.accrued_atomic,
        "settled_atomic": viewing.settled_atomic,
        "started_at": viewing.started_at,
        "last_heartbeat_at": viewing.last_heartbeat_at,
        "ended_at": viewing.ended_at,
        "settlement": {
            "status": payment.status,
            "amount_atomic": payment.amount_atomic,
            "transaction_reference": payment.transaction_reference,
            "settled_at": payment.settled_at,
        } if payment else None,
    }


@router.get("/overview")
async def get_creator_overview(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    creator_id = context.creator.id
    streams_total = await session.scalar(
        select(func.count(Stream.id)).where(Stream.creator_id == creator_id)
    ) or 0
    streams_published = await session.scalar(
        select(func.count(Stream.id)).where(Stream.creator_id == creator_id, Stream.is_published.is_(True))
    ) or 0
    streams_live = await session.scalar(
        select(func.count(Stream.id)).where(
            Stream.creator_id == creator_id,
            Stream.is_published.is_(True),
            Stream.stream_type == "livestream",
        )
    ) or 0
    sessions_total = await session.scalar(
        select(func.count(ViewingSession.id))
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .where(Stream.creator_id == creator_id)
    ) or 0
    watch_seconds = await session.scalar(
        select(func.coalesce(func.sum(ViewingSession.consumed_seconds), 0))
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .where(Stream.creator_id == creator_id)
    ) or 0
    settled_atomic = await session.scalar(
        select(func.coalesce(func.sum(Payment.amount_atomic), 0))
        .join(ViewingSession, ViewingSession.id == Payment.session_id)
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .where(Stream.creator_id == creator_id, Payment.status == "settled")
    ) or 0
    return {
        "approval_status": context.creator.approval_status,
        "streams_total": streams_total,
        "streams_published": streams_published,
        "streams_live": streams_live,
        "sessions_total": sessions_total,
        "watch_seconds": watch_seconds,
        "settled_atomic": settled_atomic,
        "generated_at": now_utc(),
    }


@router.patch("/profile")
async def update_creator_profile(
    payload: CreatorProfileUpdateRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    creator = context.creator
    updates = payload.model_dump(exclude_unset=True)
    if not updates or all(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="Provide at least one profile field to update")
    if updates.get("display_name") is not None:
        creator.display_name = updates["display_name"].strip()
        if not creator.display_name:
            raise HTTPException(status_code=422, detail="Display name cannot be blank")
    if updates.get("username") is not None:
        try:
            username = normalize_username(updates["username"])
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        existing = await session.scalar(
            select(Creator.id).where(Creator.username == username, Creator.id != creator.id)
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail="That username is already taken")
        creator.username = username
    if updates.get("social_links") is not None:
        creator.social_links = updates["social_links"]
    await session.commit()
    await session.refresh(creator)
    return {
        "id": creator.id,
        "email": creator.email,
        "username": creator.username,
        "display_name": creator.display_name,
        "wallet_address": creator.wallet_address,
        "social_links": creator.social_links or {},
        "approval_status": creator.approval_status,
        "created_at": creator.created_at,
    }


@router.get("/settings", response_model=CreatorSettingsResponse)
async def get_creator_settings(
    context: AuthContext = Depends(get_auth_context),
) -> CreatorSettingsResponse:
    return CreatorSettingsResponse.model_validate(context.creator.preferences or {})


@router.patch("/settings", response_model=CreatorSettingsResponse)
async def update_creator_settings(
    payload: CreatorSettingsUpdateRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> CreatorSettingsResponse:
    updates = {key: value for key, value in payload.model_dump(exclude_unset=True).items() if value is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="Provide at least one creator setting to update")
    updated_settings = CreatorSettingsResponse.model_validate({
        **(context.creator.preferences or {}),
        **updates,
    })
    context.creator.preferences = updated_settings.model_dump()
    await session.commit()
    return updated_settings


@router.get("/streams/{stream_id}")
async def get_creator_stream(
    stream_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    stream = await session.scalar(
        select(Stream).where(Stream.id == stream_id, Stream.creator_id == context.creator.id)
    )
    if stream is None:
        raise HTTPException(status_code=404, detail="Stream not found")
    return {
        "id": stream.id,
        "creator_wallet": context.creator.wallet_address,
        "creator_display_name": context.creator.display_name,
        "slug": stream.slug,
        "title": stream.title,
        "description": stream.description,
        "stream_type": stream.stream_type,
        "pricing": {
            "model": stream.pricing_model,
            "price_atomic": stream.price_atomic,
            "rate_atomic_per_minute": stream.rate_atomic_per_minute,
        },
        "free_preview_seconds": stream.free_preview_seconds,
        "playback_url": stream.playback_url,
        "is_published": stream.is_published,
        "created_at": stream.created_at,
        "updated_at": stream.updated_at,
    }


@router.get("/sessions")
async def list_creator_sessions(
    session_status: str | None = Query(default=None, pattern="^(active|completed)$"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    base = (
        select(ViewingSession, Stream, Payment)
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .outerjoin(Payment, Payment.session_id == ViewingSession.id)
        .where(Stream.creator_id == context.creator.id)
    )
    count_query = (
        select(func.count(ViewingSession.id))
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .where(Stream.creator_id == context.creator.id)
    )
    if session_status:
        base = base.where(ViewingSession.status == session_status)
        count_query = count_query.where(ViewingSession.status == session_status)
    total = await session.scalar(count_query) or 0
    rows = (await session.execute(
        base.order_by(ViewingSession.started_at.desc()).limit(limit).offset(offset)
    )).all()
    return {
        "items": [_session_item(viewing, stream, payment) for viewing, stream, payment in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/sessions/{session_id}")
async def get_creator_session(
    session_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    row = (await session.execute(
        select(ViewingSession, Stream, Payment)
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .outerjoin(Payment, Payment.session_id == ViewingSession.id)
        .where(ViewingSession.id == session_id, Stream.creator_id == context.creator.id)
    )).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Viewing session not found")
    return _session_item(*row)


@router.get("/receipts")
async def list_creator_receipts(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    base = (
        select(Payment, ViewingSession, Stream)
        .join(ViewingSession, ViewingSession.id == Payment.session_id)
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .where(Stream.creator_id == context.creator.id)
    )
    count_query = (
        select(func.count(Payment.id))
        .join(ViewingSession, ViewingSession.id == Payment.session_id)
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .where(Stream.creator_id == context.creator.id)
    )
    total = await session.scalar(count_query) or 0
    rows = (await session.execute(
        base.order_by(Payment.settled_at.desc()).limit(limit).offset(offset)
    )).all()
    return {
        "items": [{
            "id": payment.id,
            "session_id": viewing.id,
            "stream_id": stream.id,
            "stream_title": stream.title,
            "stream_slug": stream.slug,
            "viewer_wallet": viewing.viewer_wallet,
            "duration_seconds": viewing.consumed_seconds,
            "amount_atomic": payment.amount_atomic,
            "status": payment.status,
            "transaction_reference": payment.transaction_reference,
            "settled_at": payment.settled_at,
        } for payment, viewing, stream in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
