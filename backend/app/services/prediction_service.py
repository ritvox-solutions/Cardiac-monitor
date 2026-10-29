"""Prediction service.

Wraps the trained sklearn pipeline, label encoder, and DCSI calculator
into a single interface for the API layer.
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from app.core.config import settings
from app.core.logger import setup_logger
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.utils.dcsi import compute_dcsi

logger = setup_logger(__name__)

# Risk-bucket midpoints for converting class probabilities to a continuous score
_RISK_MIDPOINTS: dict[str, float] = {
    "Low": 15.0,
    "Medium": 45.0,
    "High": 80.0,
}

_FEATURE_ORDER: list[str] = [
    "age",
    "height_cm",
    "weight_kg",
    "bmi",
    "heart_rate",
    "spo2",
    "sleep_hours",
    "stress_level",
    "heart_rate_variability",
    "latitude",
    "longitude",
    "gender",
    "activity_level",
    "smoking",
    "diabetes",
    "hypertension",
]

_BOOL_FEATURES: set[str] = {"smoking", "diabetes", "hypertension"}


class PredictionService:
    """Singleton service that loads the ML pipeline and serves predictions."""

    _instance: "PredictionService | None" = None
    _pipeline: Pipeline | None = None
    _classes: list[str] | None = None
    _loaded: bool = False

    def __new__(cls) -> "PredictionService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load(self) -> "PredictionService":
        """Load the trained pipeline and label encoder from disk."""
        if self._loaded:
            return self

        model_path = Path(str(settings.ML_MODEL_PATH))
        encoder_path = Path(str(settings.ML_ENCODER_PATH))

        if not model_path.exists():
            raise FileNotFoundError(
                f"Model not found at {model_path}. Run the training pipeline first."
            )
        if not encoder_path.exists():
            raise FileNotFoundError(
                f"Encoder not found at {encoder_path}. Run the training pipeline first."
            )

        self._pipeline = joblib.load(model_path)
        self._label_encoder = joblib.load(encoder_path)
        self._classes = list(self._label_encoder.classes_)
        self._loaded = True

        logger.info(
            "Prediction service loaded (model=%s, classes=%s)",
            model_path.name,
            self._classes,
        )
        return self

    def is_loaded(self) -> bool:
        return self._loaded

    def unload(self) -> None:
        self._pipeline = None
        self._classes = None
        self._loaded = False
        logger.info("Prediction service unloaded")

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(self, data: PredictionInput) -> PredictionOutput:
        """Run the full prediction pipeline for a single input.

        Parameters
        ----------
        data : PredictionInput
            Validated input features.

        Returns
        -------
        PredictionOutput
            Risk level, score, confidence, and DCSI.
        """
        self.load()

        # Build a single-row DataFrame in the exact column order expected by the model
        row = self._to_dataframe(data)
        encoded = self._pipeline.predict(row)  # type: ignore[union-attr]
        probs = self._pipeline.predict_proba(row)  # type: ignore[union-attr]

        pred_label = str(self._label_encoder.inverse_transform(encoded)[0])
        confidence = float(np.max(probs[0]))

        # Probability-weighted risk score
        prob_dict = dict(zip(self._classes, probs[0]))
        risk_score = sum(
            prob_dict.get(cls, 0.0) * _RISK_MIDPOINTS.get(cls, 50.0)
            for cls in self._classes
        )

        # DCSI
        dcsi = compute_dcsi(
            heart_rate=data.heart_rate,
            spo2=data.spo2,
            heart_rate_variability=data.heart_rate_variability,
            activity_level=data.activity_level,
        )

        return PredictionOutput(
            risk_level=pred_label,
            risk_score=round(risk_score, 2),
            confidence=round(confidence, 4),
            dcsi=dcsi,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_dataframe(data: PredictionInput) -> pd.DataFrame:
        """Convert a PredictionInput to a single-row DataFrame.

        The columns are ordered to match the training pipeline.
        Defaults are provided for GPS coordinates (not required by the
        prediction model internally, but present in the feature set).
        """
        raw: dict[str, object] = {
            "age": data.age,
            "gender": data.gender,
            "height_cm": data.height_cm,
            "weight_kg": data.weight_kg,
            "bmi": data.bmi,
            "heart_rate": data.heart_rate,
            "spo2": data.spo2,
            "activity_level": data.activity_level,
            "sleep_hours": data.sleep_hours,
            "stress_level": data.stress_level,
            "smoking": data.smoking,
            "diabetes": data.diabetes,
            "hypertension": data.hypertension,
            "heart_rate_variability": data.heart_rate_variability,
            "latitude": 28.61,  # default – not used internally
            "longitude": 77.23,
        }

        df = pd.DataFrame([raw])
        df = df[_FEATURE_ORDER]

        for col in _BOOL_FEATURES:
            if col in df.columns:
                df[col] = df[col].astype(bool)

        return df
