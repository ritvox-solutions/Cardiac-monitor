"""Prediction module for the cardiac risk model.

Provides a singleton-based ``CardiacRiskPredictor`` that loads the
trained pipeline and label encoder once, then serves predictions
for single or batch inputs.

Designed to be consumed by the FastAPI backend.
"""

import warnings
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

from config import (
    ALL_FEATURES,
    BINARY_FEATURES,
    ENCODER_PATH,
    MODEL_PATH,
)
from logger import setup_logger

# Suppress sklearn feature-name warnings inside the Pipeline;
# the ColumnTransformer output is a numpy array, which is expected.
warnings.filterwarnings("ignore", message="X does not have valid feature names")

logger = setup_logger(__name__)


# ---------------------------------------------------------------------------
# Singleton Predictor
# ---------------------------------------------------------------------------

class CardiacRiskPredictor:
    """Thread-safe singleton predictor for cardiac risk.

    Usage
    -----
    >>> predictor = CardiacRiskPredictor()
    >>> result = predictor.predict({
    ...     "age": 45,
    ...     "gender": "Male",
    ...     "height_cm": 175.0,
    ...     "weight_kg": 80.0,
    ...     "bmi": 26.1,
    ...     "heart_rate": 72,
    ...     "spo2": 98.0,
    ...     "activity_level": "Moderately Active",
    ...     "sleep_hours": 7.0,
    ...     "stress_level": 40,
    ...     "smoking": False,
    ...     "diabetes": False,
    ...     "hypertension": False,
    ...     "heart_rate_variability": 55,
    ...     "latitude": 28.61,
    ...     "longitude": 77.23,
    ... })
    >>> result["risk_level"]
    "Low"
    """

    _instance: Optional["CardiacRiskPredictor"] = None
    _pipeline = None
    _label_encoder = None

    def __new__(cls) -> "CardiacRiskPredictor":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ---- Loading ----------------------------------------------------------

    def load(self) -> "CardiacRiskPredictor":
        """Load the trained pipeline and label encoder from disk.

        Returns
        -------
        CardiacRiskPredictor
            Self, for method chaining.
        """
        if self._pipeline is not None:
            return self

        model_path = Path(str(MODEL_PATH))
        encoder_path = Path(str(ENCODER_PATH))

        if not model_path.exists():
            raise FileNotFoundError(
                f"Trained model not found at {model_path}. Run train.py first."
            )
        if not encoder_path.exists():
            raise FileNotFoundError(
                f"Label encoder not found at {encoder_path}. Run train.py first."
            )

        self._pipeline = joblib.load(model_path)
        self._label_encoder = joblib.load(encoder_path)

        logger.info("Predictor loaded (model=%s, classes=%s)", model_path, self._label_encoder.classes_)
        return self

    def is_loaded(self) -> bool:
        """Check whether the model artifacts are loaded."""
        return self._pipeline is not None

    # ---- Single Prediction ------------------------------------------------

    def predict(self, features: Dict[str, object]) -> Dict[str, object]:
        """Predict cardiac risk for a single patient record.

        Parameters
        ----------
        features : Dict[str, object]
            Dictionary of feature name → value. Must contain all features
            listed in ``ALL_FEATURES``.

        Returns
        -------
        Dict[str, object]
            JSON-serialisable dictionary with keys:
            - ``risk_level``: predicted class label (str)
            - ``confidence``: probability of the predicted class (float)
            - ``probabilities``: dict of class → probability mappings
        """
        return self._predict_batch([features])[0]

    # ---- Batch Prediction -------------------------------------------------

    def predict_batch(self, records: List[Dict[str, object]]) -> List[Dict[str, object]]:
        """Predict cardiac risk for multiple patient records.

        Parameters
        ----------
        records : List[Dict[str, object]]
            List of feature dictionaries.

        Returns
        -------
        List[Dict[str, object]]
            List of prediction dictionaries.
        """
        return self._predict_batch(records)

    # ---- Internal ---------------------------------------------------------

    def _predict_batch(self, records: List[Dict[str, object]]) -> List[Dict[str, object]]:
        self.load()

        df = pd.DataFrame(records)

        # Ensure all required features are present
        for col in ALL_FEATURES:
            if col not in df.columns:
                raise ValueError(f"Missing required feature: '{col}'")

        # Reorder columns to match training order
        df = df[ALL_FEATURES]

        # Ensure type correctness
        bool_features = set(BINARY_FEATURES)
        for col in df.columns:
            if col in bool_features:
                df[col] = df[col].astype(bool)

        encoded = self._pipeline.predict(df)
        probs = self._pipeline.predict_proba(df)

        classes = self._label_encoder.classes_
        results: List[Dict[str, object]] = []

        for i in range(len(df)):
            pred_label = self._label_encoder.inverse_transform([encoded[i]])[0]
            confidence = float(np.max(probs[i]))
            probabilities = {
                str(cls): float(probs[i, j])
                for j, cls in enumerate(classes)
            }

            results.append({
                "risk_level": str(pred_label),
                "confidence": round(confidence, 4),
                "probabilities": probabilities,
            })

        return results


# ---------------------------------------------------------------------------
# Convenience Function
# ---------------------------------------------------------------------------

_predictor: Optional[CardiacRiskPredictor] = None


def predict(features: Dict[str, object]) -> Dict[str, object]:
    """One-shot convenience function for single-record prediction.

    Parameters
    ----------
    features : Dict[str, object]
        Single patient feature dictionary.

    Returns
    -------
    Dict[str, object]
        Prediction result.
    """
    global _predictor
    if _predictor is None:
        _predictor = CardiacRiskPredictor()
    return _predictor.predict(features)
