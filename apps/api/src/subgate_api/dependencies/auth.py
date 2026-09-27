import hashlib
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from subgate_api.db import get_session
from subgate_api.models import AdminSession, AdminUser, Creator, CreatorSession
from subgate_api.services.auth import now_utc


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    creator: Creator
    creator_session: CreatorSession


@dataclass(frozen=True)
class AdminAuthContext:
    admin: AdminUser
    admin_session: AdminSession


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    result = await session.execute(
        select(CreatorSession, Creator)
        .join(Creator, Creator.id == CreatorSession.creator_id)
        .where(
            CreatorSession.token_hash == token_hash,
            CreatorSession.revoked_at.is_(None),
            CreatorSession.expires_at > now_utc(),
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    creator_session, creator = row
    return AuthContext(creator=creator, creator_session=creator_session)


async def get_current_creator(context: AuthContext = Depends(get_auth_context)) -> Creator:
    return context.creator


async def get_admin_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> AdminAuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    result = await session.execute(
        select(AdminSession, AdminUser)
        .join(AdminUser, AdminUser.id == AdminSession.admin_id)
        .where(
            AdminSession.token_hash == token_hash,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now_utc(),
            AdminUser.is_active.is_(True),
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    admin_session, admin = row
    return AdminAuthContext(admin=admin, admin_session=admin_session)
