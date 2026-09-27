import os
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from subgate_api.db import get_session
from subgate_api.dependencies.auth import AdminAuthContext, get_admin_auth_context
from subgate_api.models import (
    AdminAuditEvent,
    AdminUser,
    Creator,
    Payment,
    Stream,
    ViewingSession,
)
from subgate_api.schemas import AdminStreamVisibilityRequest, CreatorStatusUpdateRequest
from subgate_api.services.streaming import now_utc


router = APIRouter(prefix="/admin", tags=["admin"])
CreatorStatus = Literal["pending", "approved", "rejected", "suspended"]
SessionStatus = Literal["active", "completed"]


async def write_audit_event(
    session: AsyncSession,
    *,
    actor_admin_id: UUID | None,
    event_type: str,
    entity_type: str,
    entity_id: UUID | str | None,
    details: dict[str, object] | None = None,
) -> None:
    session.add(
        AdminAuditEvent(
            actor_admin_id=actor_admin_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            details=details,
        )
    )


def _creator_summary(creator: Creator, stream_count: int) -> dict[str, object]:
    return {
        "id": creator.id,
        "email": creator.email,
        "username": creator.username,
        "display_name": creator.display_name,
        "wallet_address": creator.wallet_address,
        "approval_status": creator.approval_status,
        "created_at": creator.created_at,
        "stream_count": stream_count,
    }


@router.get("/overview")
async def get_admin_overview(
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    creators_total = await session.scalar(select(func.count(Creator.id))) or 0
    creators_pending = await session.scalar(
        select(func.count(Creator.id)).where(Creator.approval_status == "pending")
    ) or 0
    streams_published = await session.scalar(
        select(func.count(Stream.id)).where(Stream.is_published.is_(True))
    ) or 0
    sessions_active = await session.scalar(
        select(func.count(ViewingSession.id)).where(ViewingSession.status == "active")
    ) or 0
    settlements_count = await session.scalar(
        select(func.count(Payment.id)).where(Payment.status == "settled")
    ) or 0
    settlements_atomic = await session.scalar(
        select(func.coalesce(func.sum(Payment.amount_atomic), 0)).where(Payment.status == "settled")
    ) or 0
    return {
        "creators_total": creators_total,
        "creators_pending": creators_pending,
        "streams_published": streams_published,
        "sessions_active": sessions_active,
        "settlements_count": settlements_count,
        "settlements_atomic": settlements_atomic,
        "health": "nominal",
        "generated_at": now_utc(),
    }


@router.get("/creators")
async def list_admin_creators(
    approval_status: CreatorStatus | None = None,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    conditions = []
    if approval_status:
        conditions.append(Creator.approval_status == approval_status)
    if q and q.strip():
        pattern = f"%{q.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Creator.email).like(pattern),
                func.lower(Creator.username).like(pattern),
                func.lower(Creator.display_name).like(pattern),
                func.lower(Creator.wallet_address).like(pattern),
            )
        )

    stream_count = (
        select(func.count(Stream.id))
        .where(Stream.creator_id == Creator.id)
        .correlate(Creator)
        .scalar_subquery()
    )
    base = select(Creator, stream_count.label("stream_count"))
    count_query = select(func.count(Creator.id))
    if conditions:
        base = base.where(*conditions)
        count_query = count_query.where(*conditions)
    total = await session.scalar(count_query) or 0
    rows = (await session.execute(
        base.order_by(Creator.created_at.desc()).limit(limit).offset(offset)
    )).all()
    return {
        "items": [_creator_summary(creator, stream_count_value) for creator, stream_count_value in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/creators/{creator_id}")
async def get_admin_creator(
    creator_id: UUID,
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    creator = await session.get(Creator, creator_id)
    if creator is None:
        raise HTTPException(status_code=404, detail="Creator not found")
    streams_count = await session.scalar(
        select(func.count(Stream.id)).where(Stream.creator_id == creator.id)
    ) or 0
    sessions_count = await session.scalar(
        select(func.count(ViewingSession.id))
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .where(Stream.creator_id == creator.id)
    ) or 0
    stream_rows = (await session.execute(
        select(Stream).where(Stream.creator_id == creator.id).order_by(Stream.created_at.desc())
    )).scalars().all()
    return {
        **_creator_summary(creator, streams_count),
        "social_links": creator.social_links or {},
        "sessions_count": sessions_count,
        "streams": [{
            "id": stream.id,
            "slug": stream.slug,
            "title": stream.title,
            "stream_type": stream.stream_type,
            "is_published": stream.is_published,
            "created_at": stream.created_at,
        } for stream in stream_rows],
    }


@router.patch("/creators/{creator_id}/status")
async def update_creator_status(
    creator_id: UUID,
    payload: CreatorStatusUpdateRequest,
    context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    creator = await session.get(Creator, creator_id)
    if creator is None:
        raise HTTPException(status_code=404, detail="Creator not found")
    previous_status = creator.approval_status
    creator.approval_status = payload.approval_status
    unpublished_count = 0
    if payload.approval_status in {"rejected", "suspended"}:
        result = await session.execute(
            update(Stream)
            .where(Stream.creator_id == creator.id, Stream.is_published.is_(True))
            .values(is_published=False)
        )
        unpublished_count = result.rowcount or 0
    await write_audit_event(
        session,
        actor_admin_id=context.admin.id,
        event_type="creator.status_changed",
        entity_type="creator",
        entity_id=creator.id,
        details={
            "from": previous_status,
            "to": payload.approval_status,
            "reason": payload.reason,
            "streams_unpublished": unpublished_count,
        },
    )
    await session.commit()
    return {
        "id": creator.id,
        "approval_status": creator.approval_status,
        "streams_unpublished": unpublished_count,
        "updated_at": now_utc(),
    }


@router.get("/streams")
async def list_admin_streams(
    is_published: bool | None = None,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    conditions = []
    if is_published is not None:
        conditions.append(Stream.is_published.is_(is_published))
    if q and q.strip():
        pattern = f"%{q.strip().lower()}%"
        conditions.append(or_(func.lower(Stream.title).like(pattern), func.lower(Stream.slug).like(pattern)))
    base = select(Stream, Creator).join(Creator, Creator.id == Stream.creator_id)
    count_query = select(func.count(Stream.id)).join(Creator, Creator.id == Stream.creator_id)
    if conditions:
        base = base.where(*conditions)
        count_query = count_query.where(*conditions)
    total = await session.scalar(count_query) or 0
    rows = (await session.execute(
        base.order_by(Stream.created_at.desc()).limit(limit).offset(offset)
    )).all()
    items = []
    for stream, creator in rows:
        items.append({
            "id": stream.id,
            "slug": stream.slug,
            "title": stream.title,
            "description": stream.description,
            "playback_url": stream.playback_url,
            "stream_type": stream.stream_type,
            "pricing_model": stream.pricing_model,
            "price_atomic": stream.price_atomic,
            "rate_atomic_per_minute": stream.rate_atomic_per_minute,
            "is_published": stream.is_published,
            "created_at": stream.created_at,
            "updated_at": stream.updated_at,
            "creator": {
                "id": creator.id,
                "email": creator.email,
                "username": creator.username,
                "display_name": creator.display_name,
                "wallet_address": creator.wallet_address,
                "approval_status": creator.approval_status,
            },
        })
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.patch("/streams/{stream_id}/visibility")
async def update_stream_visibility(
    stream_id: UUID,
    payload: AdminStreamVisibilityRequest,
    context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    stream = await session.get(Stream, stream_id)
    if stream is None:
        raise HTTPException(status_code=404, detail="Stream not found")
    if payload.is_published:
        creator = await session.get(Creator, stream.creator_id)
        if creator is None or creator.approval_status != "approved":
            raise HTTPException(status_code=409, detail="Only approved creators can publish streams")
    previous = stream.is_published
    stream.is_published = payload.is_published
    await write_audit_event(
        session,
        actor_admin_id=context.admin.id,
        event_type="stream.visibility_changed",
        entity_type="stream",
        entity_id=stream.id,
        details={"from": previous, "to": payload.is_published, "reason": payload.reason},
    )
    await session.commit()
    return {"id": stream.id, "is_published": stream.is_published, "updated_at": now_utc()}


@router.get("/sessions")
async def list_admin_sessions(
    session_status: SessionStatus | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    base = (
        select(ViewingSession, Stream, Creator, Payment)
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .join(Creator, Creator.id == Stream.creator_id)
        .outerjoin(Payment, Payment.session_id == ViewingSession.id)
    )
    count_query = select(func.count(ViewingSession.id))
    if session_status:
        base = base.where(ViewingSession.status == session_status)
        count_query = count_query.where(ViewingSession.status == session_status)
    total = await session.scalar(count_query) or 0
    rows = (await session.execute(
        base.order_by(ViewingSession.started_at.desc()).limit(limit).offset(offset)
    )).all()
    items = []
    for viewing, stream, creator, payment in rows:
        items.append({
            "id": viewing.id,
            "stream_id": stream.id,
            "stream_title": stream.title,
            "stream_slug": stream.slug,
            "creator_id": creator.id,
            "creator_name": creator.display_name,
            "viewer_wallet": viewing.viewer_wallet,
            "status": viewing.status,
            "consumed_seconds": viewing.consumed_seconds,
            "accrued_atomic": viewing.accrued_atomic,
            "settled_atomic": viewing.settled_atomic,
            "started_at": viewing.started_at,
            "last_heartbeat_at": viewing.last_heartbeat_at,
            "ended_at": viewing.ended_at,
            "settlement_status": payment.status if payment else None,
        })
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/settlements")
async def list_admin_settlements(
    payment_status: str | None = Query(default=None, max_length=24),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    base = (
        select(Payment, ViewingSession, Stream, Creator)
        .join(ViewingSession, ViewingSession.id == Payment.session_id)
        .join(Stream, Stream.id == ViewingSession.stream_id)
        .join(Creator, Creator.id == Stream.creator_id)
    )
    count_query = select(func.count(Payment.id))
    if payment_status:
        base = base.where(Payment.status == payment_status)
        count_query = count_query.where(Payment.status == payment_status)
    total = await session.scalar(count_query) or 0
    rows = (await session.execute(
        base.order_by(Payment.settled_at.desc()).limit(limit).offset(offset)
    )).all()
    items = []
    for payment, viewing, stream, creator in rows:
        items.append({
            "id": payment.id,
            "session_id": viewing.id,
            "stream_id": stream.id,
            "stream_title": stream.title,
            "creator_id": creator.id,
            "creator_name": creator.display_name,
            "viewer_wallet": viewing.viewer_wallet,
            "amount_atomic": payment.amount_atomic,
            "status": payment.status,
            "transaction_reference": payment.transaction_reference,
            "settled_at": payment.settled_at,
        })
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/audit")
async def list_admin_audit_events(
    event_type: str | None = Query(default=None, max_length=64),
    entity_type: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    base = select(AdminAuditEvent, AdminUser).outerjoin(
        AdminUser, AdminUser.id == AdminAuditEvent.actor_admin_id
    )
    count_query = select(func.count(AdminAuditEvent.id))
    conditions = []
    if event_type:
        conditions.append(AdminAuditEvent.event_type == event_type)
    if entity_type:
        conditions.append(AdminAuditEvent.entity_type == entity_type)
    if conditions:
        base = base.where(*conditions)
        count_query = count_query.where(*conditions)
    total = await session.scalar(count_query) or 0
    rows = (await session.execute(
        base.order_by(AdminAuditEvent.created_at.desc()).limit(limit).offset(offset)
    )).all()
    items = [{
        "id": event.id,
        "actor": {"id": actor.id, "email": actor.email, "username": actor.username} if actor else None,
        "event_type": event.event_type,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "details": event.details or {},
        "created_at": event.created_at,
    } for event, actor in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/reports/revenue")
async def get_revenue_report(
    days: int = Query(default=30, ge=1, le=365),
    _context: AdminAuthContext = Depends(get_admin_auth_context),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    since = datetime.now(UTC) - timedelta(days=days - 1)
    day_column = func.date(Payment.settled_at).label("day")
    rows = (await session.execute(
        select(day_column, func.count(Payment.id), func.coalesce(func.sum(Payment.amount_atomic), 0))
        .where(Payment.status == "settled", Payment.settled_at >= since)
        .group_by(day_column)
        .order_by(day_column.asc())
    )).all()
    return {
        "period_days": days,
        "since": since,
        "totals": {
            "settlements": sum(row[1] for row in rows),
            "amount_atomic": sum(row[2] for row in rows),
        },
        "daily": [
            {"date": row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0]),
             "settlements": row[1], "amount_atomic": row[2]}
            for row in rows
        ],
    }


@router.get("/settings")
async def get_admin_settings(
    _context: AdminAuthContext = Depends(get_admin_auth_context),
) -> dict[str, object]:
    """Expose non-secret effective settings; write access stays with deployment config."""
    return {
        "settlement_mode": os.getenv("SUBGATE_SETTLEMENT_MODE", "local").strip().lower(),
        "network": os.getenv("X402_NETWORK", "eip155:421614"),
        "chain_id": int(os.getenv("ARBITRUM_CHAIN_ID", "421614")),
        "platform_fee_percent": float(os.getenv("PLATFORM_FEE_PERCENT", "5")),
        "asset": os.getenv("USDC_ADDRESS") or os.getenv("X402_ASSET", ""),
        "gateway_wallet_address": os.getenv("X402_GATEWAY_WALLET_ADDRESS", ""),
        "facilitator_url": os.getenv("X402_FACILITATOR_URL", "https://gateway-api-testnet.circle.com"),
        "max_timeout_seconds": int(os.getenv("X402_MAX_TIMEOUT_SECONDS", "300")),
        "editable_in_dashboard": False,
    }
