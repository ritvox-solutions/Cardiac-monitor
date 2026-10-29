"""Application configuration.

All environment-sensitive values are loaded from a ``.env`` file
(or environment variables) via Pydantic Settings.
"""

from pathlib import Path
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Centralised settings for the FastAPI application."""

    # ---- Application -------------------------------------------------------
    APP_NAME: str = "Wearable Cardiac Risk Monitoring API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "debug", "dev", "development")
        return bool(v)

    # ---- Server ------------------------------------------------------------
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ---- CORS --------------------------------------------------------------
    CORS_ORIGINS: str = "*"

    # ---- PostgreSQL --------------------------------------------------------
    DATABASE_URL: str = "postgresql+asyncpg://postgres:admin123@localhost:5432/cardiac_risk_db"

    # ---- ML Model Paths (relative to this file's parent) -------------------
    _BASE: Path = Path(__file__).resolve().parent.parent  # app/

    ML_MODEL_PATH: Path = _BASE / "ml" / "cardiac_model.pkl"
    ML_SCALER_PATH: Path = _BASE / "ml" / "scaler.pkl"
    ML_ENCODER_PATH: Path = _BASE / "ml" / "label_encoder.pkl"
    ML_FEATURE_COLUMNS_PATH: Path = _BASE / "ml" / "feature_columns.pkl"

    # ---- Logging -----------------------------------------------------------
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str | None = None

    # ---- Rate Limiting (placeholder) --------------------------------------
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
