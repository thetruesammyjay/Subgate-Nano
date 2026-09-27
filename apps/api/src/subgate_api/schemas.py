from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, model_validator

PricingModel = Literal["pay_per_view", "metered"]
StreamType = Literal["video", "livestream"]


class CreatorResponse(BaseModel):
    id: UUID
    wallet_address: str | None
    display_name: str
    username: str | None
    email: str | None
    social_links: dict[str, str]
    approval_status: Literal["pending", "approved", "rejected", "suspended"]
    created_at: datetime


class CreatorProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(default=None, min_length=3, max_length=40)
    social_links: dict[str, str] | None = None


class CreatorSettingsResponse(BaseModel):
    default_preview_seconds: int = Field(default=30, ge=0, le=3600)
    email_notifications: bool = True
    session_notifications: bool = False
    settlement_notifications: bool = True


class CreatorSettingsUpdateRequest(BaseModel):
    default_preview_seconds: int | None = Field(default=None, ge=0, le=3600)
    email_notifications: bool | None = None
    session_notifications: bool | None = None
    settlement_notifications: bool | None = None


class AuthChallengeRequest(BaseModel):
    wallet_address: str = Field(min_length=42, max_length=42)


class AuthChallengeResponse(BaseModel):
    challenge_id: UUID
    wallet_address: str
    message: str
    expires_at: datetime


class VerifyCreatorRequest(BaseModel):
    challenge_id: UUID
    wallet_address: str = Field(min_length=42, max_length=42)
    signature: str = Field(min_length=1, max_length=256)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    creator: CreatorResponse


class CreatorRegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    username: str = Field(min_length=3, max_length=40)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    social_links: dict[str, str] = Field(default_factory=dict)
    wallet_address: str | None = Field(default=None, min_length=42, max_length=42)


class CreatorLoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class AdminResponse(BaseModel):
    id: UUID
    email: str
    username: str
    created_at: datetime


class AdminLoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class AdminAuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    admin: AdminResponse


class PricingInput(BaseModel):
    model: PricingModel
    price_atomic: int | None = Field(default=None, gt=0)
    rate_atomic_per_minute: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_model_fields(self) -> "PricingInput":
        if self.model == "pay_per_view" and self.price_atomic is None:
            raise ValueError("pay_per_view pricing requires price_atomic")
        if self.model == "metered" and self.rate_atomic_per_minute is None:
            raise ValueError("metered pricing requires rate_atomic_per_minute")
        if self.model == "pay_per_view" and self.rate_atomic_per_minute is not None:
            raise ValueError("pay_per_view pricing cannot include a metered rate")
        if self.model == "metered" and self.price_atomic is not None:
            raise ValueError("metered pricing cannot include a fixed price")
        return self


class CreateStreamRequest(BaseModel):
    creator_wallet: str = Field(min_length=3, max_length=42)
    creator_display_name: str = Field(min_length=1, max_length=120)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=180)
    title: str = Field(min_length=1, max_length=160)
    description: str = ""
    stream_type: StreamType
    pricing: PricingInput
    free_preview_seconds: int = Field(default=0, ge=0, le=3600)
    playback_url: HttpUrl
    is_published: bool = True


class UpdateStreamRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    pricing: PricingInput | None = None
    free_preview_seconds: int | None = Field(default=None, ge=0, le=3600)
    playback_url: HttpUrl | None = None
    is_published: bool | None = None


class PricingResponse(BaseModel):
    model: PricingModel
    price_atomic: int | None
    rate_atomic_per_minute: int | None


class StreamResponse(BaseModel):
    id: UUID
    creator_wallet: str
    creator_display_name: str
    slug: str
    title: str
    description: str
    stream_type: StreamType
    pricing: PricingResponse
    free_preview_seconds: int
    playback_url: str
    is_published: bool
    created_at: datetime


class StartSessionRequest(BaseModel):
    viewer_wallet: str = Field(min_length=3, max_length=42)
    max_spend_atomic: int | None = Field(default=None, gt=0)
    payment_signature: str | None = Field(default=None, min_length=1)


class HeartbeatRequest(BaseModel):
    playing: bool
    playback_position_seconds: int | None = Field(default=None, ge=0)


class StopSessionRequest(BaseModel):
    payment_signature: str | None = Field(default=None, min_length=1)


class SessionResponse(BaseModel):
    id: UUID
    stream_id: UUID
    viewer_wallet: str
    status: Literal["active", "completed"]
    max_spend_atomic: int | None
    consumed_seconds: int
    accrued_atomic: int
    settled_atomic: int
    started_at: datetime
    last_heartbeat_at: datetime
    ended_at: datetime | None
    playback_token: str | None = None
    playback_url: str | None = None


class PlaybackTokenResponse(BaseModel):
    session_id: UUID
    stream_id: UUID
    token: str
    playback_url: str
    expires_at: datetime


class ReceiptResponse(BaseModel):
    session_id: UUID
    stream_id: UUID
    viewer_wallet: str
    duration_seconds: int
    amount_atomic: int
    currency: Literal["USDC"] = "USDC"
    settlement_status: Literal["settled"] = "settled"
    transaction_reference: str
    settled_at: datetime


class CreatorStatusUpdateRequest(BaseModel):
    approval_status: Literal["pending", "approved", "rejected", "suspended"]
    reason: str | None = Field(default=None, max_length=500)


class AdminStreamVisibilityRequest(BaseModel):
    is_published: bool
    reason: str | None = Field(default=None, max_length=500)
