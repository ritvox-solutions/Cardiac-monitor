"""Configuration settings for the ML pipeline.

All paths, hyperparameters, and feature definitions are centralized here
to avoid hardcoded values throughout the codebase.
"""

from pathlib import Path
from typing import Dict, List, Any


# ---------------------------------------------------------------------------
# Directory Layout
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

DATASET_DIR = BASE_DIR / "dataset"
ML_DIR = BASE_DIR / "ml"
MODELS_DIR = BASE_DIR / "trained_models"
REPORTS_DIR = BASE_DIR / "reports"

DATASET_PATH = DATASET_DIR / "dataset.csv"

# ---------------------------------------------------------------------------
# Training Parameters
# ---------------------------------------------------------------------------

RANDOM_SEED: int = 42
TEST_SIZE: float = 0.2
CV_FOLDS: int = 5

# ---------------------------------------------------------------------------
# Target & Feature Configuration
# ---------------------------------------------------------------------------

TARGET_COLUMN: str = "risk_level"
CLASS_LABELS: List[str] = ["Low", "Medium", "High"]

DROP_COLUMNS: List[str] = [
    "user_id",
    "risk_score",
]

NUMERIC_FEATURES: List[str] = [
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
]

CATEGORICAL_FEATURES: List[str] = [
    "gender",
    "activity_level",
]

BINARY_FEATURES: List[str] = [
    "smoking",
    "diabetes",
    "hypertension",
]

ALL_FEATURES: List[str] = NUMERIC_FEATURES + CATEGORICAL_FEATURES + BINARY_FEATURES

# ---------------------------------------------------------------------------
# Model Hyperparameters
# ---------------------------------------------------------------------------

LOGISTIC_REGRESSION_PARAMS: Dict[str, Any] = {
    "max_iter": 1000,
    "random_state": RANDOM_SEED,
    "C": 1.0,
    "solver": "lbfgs",
}

DECISION_TREE_PARAMS: Dict[str, Any] = {
    "max_depth": 12,
    "min_samples_split": 10,
    "min_samples_leaf": 5,
    "random_state": RANDOM_SEED,
}

RANDOM_FOREST_PARAMS: Dict[str, Any] = {
    "n_estimators": 300,
    "max_depth": 18,
    "min_samples_split": 10,
    "min_samples_leaf": 4,
    "random_state": RANDOM_SEED,
    "n_jobs": -1,
}

GRADIENT_BOOSTING_PARAMS: Dict[str, Any] = {
    "n_estimators": 300,
    "max_depth": 6,
    "learning_rate": 0.08,
    "subsample": 0.8,
    "min_samples_split": 10,
    "min_samples_leaf": 5,
    "random_state": RANDOM_SEED,
}

XGBOOST_PARAMS: Dict[str, Any] = {
    "n_estimators": 300,
    "max_depth": 6,
    "learning_rate": 0.08,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": RANDOM_SEED,
    "eval_metric": "mlogloss",
    "verbosity": 0,
}

# ---------------------------------------------------------------------------
# Artifact Paths
# ---------------------------------------------------------------------------

MODEL_PATH: Path = MODELS_DIR / "cardiac_model.pkl"
SCALER_PATH: Path = MODELS_DIR / "scaler.pkl"
ENCODER_PATH: Path = MODELS_DIR / "label_encoder.pkl"
FEATURE_COLUMNS_PATH: Path = MODELS_DIR / "feature_columns.pkl"
METRICS_PATH: Path = MODELS_DIR / "metrics.json"

# ---------------------------------------------------------------------------
# Report Paths
# ---------------------------------------------------------------------------

CLASSIFICATION_REPORT_PATH: Path = REPORTS_DIR / "classification_report.txt"
CONFUSION_MATRIX_PATH: Path = REPORTS_DIR / "confusion_matrix.png"
ROC_CURVE_PATH: Path = REPORTS_DIR / "roc_curve.png"
FEATURE_IMPORTANCE_PATH: Path = REPORTS_DIR / "feature_importance.png"

# ---------------------------------------------------------------------------
# Model Selection
# ---------------------------------------------------------------------------

F1_TOLERANCE: float = 0.02

MODEL_COMPLEXITY: Dict[str, int] = {
    "LogisticRegression": 1,
    "DecisionTree": 2,
    "RandomForest": 3,
    "GradientBoosting": 4,
    "XGBoost": 5,
}
