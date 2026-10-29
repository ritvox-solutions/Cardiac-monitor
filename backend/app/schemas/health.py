"""Health-check response schema."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response body for the ``GET /health`` endpoint."""

    status: str
    model_loaded: bool
    database: str
    version: str
