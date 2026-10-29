"""Prediction request / response schemas."""

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class PredictionInput(BaseModel):
    """Features required to make a cardiac risk prediction.

    All fields must be provided.  Validation ensures values fall within
    medically realistic ranges.
    """

    age: int = Field(..., ge=18, le=90, description="Patient age (18–90)")
    gender: str = Field(..., description="'Male' or 'Female'")
    height_cm: float = Field(..., ge=140, le=220)
    weight_kg: float = Field(..., ge=35, le=160)
    bmi: float = Field(..., ge=14, le=46)
    heart_rate: int = Field(..., ge=40, le=190)
    spo2: float = Field(..., ge=75, le=100)
    activity_level: str = Field(
        ...,
        description="One of: Sedentary, Lightly Active, Moderately Active, Very Active",
    )
    sleep_hours: float = Field(..., ge=2, le=12)
    stress_level: int = Field(..., ge=0, le=100)
    smoking: bool = False
    diabetes: bool = False
    hypertension: bool = False
    heart_rate_variability: int = Field(..., ge=10, le=130)

    # ---- Validators --------------------------------------------------------

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        if v not in ("Male", "Female"):
            raise ValueError("gender must be 'Male' or 'Female'")
        return v

    @field_validator("activity_level")
    @classmethod
    def validate_activity(cls, v: str) -> str:
        allowed = {"Sedentary", "Lightly Active", "Moderately Active", "Very Active"}
        if v not in allowed:
            raise ValueError(f"activity_level must be one of {allowed}")
        return v


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class PredictionOutput(BaseModel):
    """Result of a cardiac risk prediction."""

    risk_level: str = Field(description="Predicted risk category: Low, Medium, or High")
    risk_score: float = Field(description="Probability-weighted risk score (0–100)")
    confidence: float = Field(description="Confidence in the predicted class (0–1)")
    dcsi: float = Field(description="Daily Cardiac Stress Index (0–100)")
