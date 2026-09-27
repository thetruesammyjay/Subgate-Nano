import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Creator(Base):
    __tablename__ = "creators"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    wallet_address: Mapped[str | None] = mapped_column(String(42), unique=True, index=True, nullable=True)
    display_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True, nullable=True)
    username: Mapped[str | None] = mapped_column(String(40), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    social_links: Mapped[dict[str, str] | None] = mapped_column(JSON, default=dict, nullable=True)
    preferences: Mapped[dict[str, object] | None] = mapped_column(JSON, default=dict, nullable=True)
    approval_status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    streams: Mapped[list["Stream"]] = relationship(back_populates="creator")
    sessions: Mapped[list["CreatorSession"]] = relationship(back_populates="creator")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sessions: Mapped[list["AdminSession"]] = relationship(back_populates="admin")


class CreatorAuthChallenge(Base):
    __tablename__ = "creator_auth_challenges"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    wallet_address: Mapped[str] = mapped_column(String(42), index=True)
    message: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CreatorSession(Base):
    __tablename__ = "creator_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("creators.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    creator: Mapped[Creator] = relationship(back_populates="sessions")


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    admin: Mapped[AdminUser] = relationship(back_populates="sessions")


class AdminAuditEvent(Base):
    __tablename__ = "admin_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    actor_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(32), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    details: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Stream(Base):
    __tablename__ = "streams"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("creators.id", ondelete="CASCADE"), index=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    stream_type: Mapped[str] = mapped_column(String(16))
    pricing_model: Mapped[str] = mapped_column(String(24))
    price_atomic: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rate_atomic_per_minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    free_preview_seconds: Mapped[int] = mapped_column(Integer, default=0)
    playback_url: Mapped[str] = mapped_column(String(2048))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    creator: Mapped[Creator] = relationship(back_populates="streams")
    sessions: Mapped[list["ViewingSession"]] = relationship(back_populates="stream")


class ViewingSession(Base):
    __tablename__ = "viewing_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    stream_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("streams.id", ondelete="CASCADE"), index=True)
    viewer_wallet: Mapped[str] = mapped_column(String(42), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    max_spend_atomic: Mapped[int | None] = mapped_column(Integer, nullable=True)
    consumed_seconds: Mapped[int] = mapped_column(Integer, default=0)
    accrued_atomic: Mapped[int] = mapped_column(Integer, default=0)
    settled_atomic: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stream: Mapped[Stream] = relationship(back_populates="sessions")
    payment: Mapped["Payment | None"] = relationship(back_populates="session")
    playback_tokens: Mapped[list["PlaybackToken"]] = relationship(back_populates="session")


class PlaybackToken(Base):
    __tablename__ = "playback_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("viewing_sessions.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    session: Mapped[ViewingSession] = relationship(back_populates="playback_tokens")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (UniqueConstraint("session_id", name="payments_session_id_key"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("viewing_sessions.id", ondelete="CASCADE"), index=True)
    amount_atomic: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="settled")
    transaction_reference: Mapped[str] = mapped_column(String(255), unique=True)
    settled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    session: Mapped[ViewingSession] = relationship(back_populates="payment")
