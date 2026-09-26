import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Creator(Base):
    __tablename__ = "creators"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    wallet_address: Mapped[str] = mapped_column(String(42), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    streams: Mapped[list["Stream"]] = relationship(back_populates="creator")
    sessions: Mapped[list["CreatorSession"]] = relationship(back_populates="creator")


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
