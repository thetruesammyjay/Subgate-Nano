"""Idempotent development seed for operational accounts."""

import asyncio
import os
from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
from sqlalchemy import select

from subgate_api.db import SessionLocal
from subgate_api.models import AdminUser
from subgate_api.services.auth import hash_password, normalize_email, normalize_username


async def seed_admin() -> bool:
    email_value = os.getenv("ADMIN_EMAIL", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "")
    username_value = os.getenv("ADMIN_USERNAME", "admin").strip()
    if not email_value or not password:
        print("Admin seed skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in apps/api/.env.")
        return False
    if len(password) < 8:
        raise ValueError("ADMIN_PASSWORD must be at least 8 characters")

    email = normalize_email(email_value)
    username = normalize_username(username_value)
    async with SessionLocal() as session:
        admin = await session.scalar(select(AdminUser).where(AdminUser.email == email))
        if admin is None:
            admin = AdminUser(email=email, username=username, password_hash=hash_password(password), is_active=True)
            session.add(admin)
            message = f"Seeded admin account {email}."
        else:
            admin.username = username
            admin.password_hash = hash_password(password)
            admin.is_active = True
            message = f"Updated admin account {email}."
        await session.commit()
    print(message)
    return True


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    asyncio.run(seed_admin())


if __name__ == "__main__":
    main()
