"""Shared pytest fixtures for the backend test-suite.

The smoke tests run without a live PostgreSQL instance.  A lightweight fake
async session is injected in place of :func:`app.api.dependencies.get_db_session`
so that:

* endpoints which tolerate a missing database (``/health``) still return 200, and
* endpoints which require persistence fail cleanly with HTTP 500 rather than
  raising an unhandled ``RuntimeError`` out of the ASGI stack.
"""

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_db_session
from app.main import app
from app.services.prediction_service import PredictionService


class _FakeResult:
    """Minimal stand-in for a SQLAlchemy ``Result``."""

    def scalar_one_or_none(self) -> None:
        return None

    def scalars(self) -> "_FakeResult":
        return self

    def all(self) -> "list[object]":
        return []


class _FakeAsyncSession:
    """No-op async session that mimics the subset of the API the routes use.

    Any query-executing call raises, which the routes translate into a
    well-formed HTTP 500 response instead of a crash.
    """

    async def execute(self, *args: object, **kwargs: object) -> _FakeResult:
        raise RuntimeError("database is not available in the test environment")

    def add(self, _obj: object) -> None:  # pragma: no cover - trivial
        pass

    async def commit(self) -> None:  # pragma: no cover - trivial
        pass

    async def rollback(self) -> None:  # pragma: no cover - trivial
        pass

    async def refresh(self, _obj: object) -> None:  # pragma: no cover - trivial
        pass

    async def close(self) -> None:  # pragma: no cover - trivial
        pass


async def _fake_get_db_session() -> AsyncIterator[_FakeAsyncSession]:
    yield _FakeAsyncSession()


@pytest.fixture(autouse=True)
def _override_db() -> AsyncIterator[None]:
    """Route every ``get_db_session`` dependency to the fake session."""
    app.dependency_overrides[get_db_session] = _fake_get_db_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture(autouse=True)
def _preload_model() -> None:
    """Load the ML model once so ``/predict`` works; ignore if not built."""
    try:
        PredictionService().load()
    except Exception:
        pass


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async HTTP client bound to the ASGI app.

    ``raise_app_exceptions=False`` lets the application's own exception
    handlers produce a 500 response rather than propagating into the test.
    """
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
