"""Prediction endpoint.

``POST /predict`` — accepts patient features and returns
cardiac risk level, score, confidence, and DCSI.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_prediction_service
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.services.prediction_service import PredictionService
from app.core.logger import setup_logger

logger = setup_logger(__name__)
router = APIRouter(tags=["Prediction"])


@router.post(
    "/predict",
    response_model=PredictionOutput,
    status_code=status.HTTP_200_OK,
    summary="Predict cardiac risk",
    description=(
        "Provide demographic, vital-sign, and lifestyle features to receive "
        "a cardiac risk assessment.  Returns the predicted risk level, "
        "a continuous risk score, confidence, and the Daily Cardiac Stress Index."
    ),
)
async def predict(
    data: PredictionInput,
    predictor: PredictionService = Depends(get_prediction_service),
) -> PredictionOutput:
    """Make a cardiac risk prediction."""
    logger.info(
        "Prediction request: age=%s hr=%s spo2=%s",
        data.age, data.heart_rate, data.spo2,
    )

    try:
        result = predictor.predict(data)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Prediction failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction processing error",
        ) from exc

    logger.info(
        "Prediction result: level=%s score=%s confidence=%.4f dcsi=%s",
        result.risk_level, result.risk_score, result.confidence, result.dcsi,
    )
    return result
