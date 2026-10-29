"""User profile request / response schemas."""

from datetime import datetime
from pydantic import BaseModel, Field


class UserProfileInput(BaseModel):
    """User profile data for risk calculation and record keeping."""

    user_id: str = Field(..., description="Unique patient/user identifier")
    age: int = Field(..., ge=18, le=100)
    gender: str = Field(..., description="Male or Female")
    height_cm: float = Field(..., ge=100.0, le=250.0)
    weight_kg: float = Field(..., ge=30.0, le=250.0)
    bmi: float = Field(..., ge=10.0, le=60.0)
    smoking: bool = False
    diabetes: bool = False
    hypertension: bool = False


class UserProfileOutput(UserProfileInput):
    """User profile returned from database."""

    id: int
    created_at: datetime
    updated_at: datetime | None = None
