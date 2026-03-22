#!/usr/bin/env python3
"""
Create a smoke-test user for health-check / monitoring purposes.

Usage:
    cd backend/src && python ../scripts/create_smoke_test_user.py

The script generates a random password and prints it to the terminal.
"""

import asyncio
import os
import secrets
import string
import sys

# Ensure src/ is on sys.path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


SMOKE_EMAIL = "smoke-test@deepsightsynthesis.com"
SMOKE_USERNAME = "smoke-test"
SMOKE_PLAN = "free"


def _generate_password(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def main() -> None:
    from dotenv import load_dotenv

    # Load .env from backend/ root
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)

    from db.database import (
        User,
        async_session_maker,
        engine,
        hash_password,
        Base,
    )
    from sqlalchemy import select

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    password = _generate_password()

    async with async_session_maker() as session:
        # Check if user already exists
        result = await session.execute(
            select(User).where(User.email == SMOKE_EMAIL)
        )
        existing = result.scalars().first()

        if existing:
            # Update password
            existing.password_hash = hash_password(password)
            existing.email_verified = True
            existing.plan = SMOKE_PLAN
            await session.commit()
            print(f"Smoke-test user updated (id={existing.id})")
        else:
            # Create user
            user = User(
                username=SMOKE_USERNAME,
                email=SMOKE_EMAIL,
                password_hash=hash_password(password),
                email_verified=True,
                plan=SMOKE_PLAN,
                credits=250,
            )
            session.add(user)
            await session.commit()
            print(f"Smoke-test user created (id={user.id})")

    print(f"  email:    {SMOKE_EMAIL}")
    print(f"  password: {password}")
    print(f"  plan:     {SMOKE_PLAN}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
