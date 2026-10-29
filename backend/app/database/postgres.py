"""Async PostgreSQL client using SQLAlchemy 2.0 + asyncpg.

Provides a singleton engine and session factory, plus a FastAPI
dependency for obtaining a database session.
"""

from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.logger import setup_logger

logger = setup_logger(__name__)

engine: AsyncEngine | None = None
async_session_maker: async_sessionmaker[AsyncSession] | None = None


async def connect_to_postgres() -> AsyncEngine:
    """Initialise the global PostgreSQL engine and session maker.

    Returns
    -------
    create_async_engine
    """
    global engine, async_session_maker
    url = settings.DATABASE_URL
    # Ensure asyncpg driver is used even if standard postgresql:// URL is provided
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    import re

    # asyncpg expects ssl=... rather than sslmode=... and does not support channel_binding
    if "sslmode=" in url:
        url = url.replace("sslmode=require", "ssl=require").replace("sslmode=", "ssl=")
    url = re.sub(r'[?&]channel_binding=[^&]+', '', url)

    engine = create_async_engine(
        url,
        echo=False,
        pool_size=5,
        max_overflow=10,
    )
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("PostgreSQL connection established")
    except Exception as exc:
        logger.warning("PostgreSQL not available: %s", exc)
        logger.warning("API will run in degraded mode (no persistence)")

    return engine


async def close_postgres() -> None:
    """Dispose of the global PostgreSQL engine."""
    global engine
    if engine is not None:
        await engine.dispose()
        logger.info("PostgreSQL connection closed")
    engine = None
    async_session_maker = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session.

    The session is committed on success or rolled back on exception.

    Yields
    ------
    AsyncSession
    """
    if async_session_maker is None:
        raise RuntimeError("PostgreSQL session maker is not initialised")

    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
