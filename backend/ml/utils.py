"""Utility functions for the ML pipeline.

Handles dataset loading, validation, and general-purpose helpers.
"""

from pathlib import Path

import pandas as pd

from config import CLASS_LABELS
from logger import setup_logger

logger = setup_logger(__name__)


# ---------------------------------------------------------------------------
# Dataset I/O
# ---------------------------------------------------------------------------

def load_dataset(path: str | Path) -> pd.DataFrame:
    """Load a CSV dataset and log basic information.

    Parameters
    ----------
    path : str | Path
        Path to the CSV file.

    Returns
    -------
    pd.DataFrame
        Loaded dataset.

    Raises
    ------
    FileNotFoundError
        If the file does not exist.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")

    logger.info("Loading dataset from %s", path)
    df = pd.read_csv(path)
    logger.info("Dataset loaded: %s rows x %s columns", df.shape[0], df.shape[1])
    return df


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_dataset(df: pd.DataFrame, target_column: str) -> None:
    """Run integrity checks on the raw dataset.

    Checks for empty data, missing values, duplicates, and target validity.

    Parameters
    ----------
    df : pd.DataFrame
        Dataset to validate.
    target_column : str
        Name of the target column.

    Raises
    ------
    ValueError
        If any validation check fails.
    """
    if df.empty:
        raise ValueError("Dataset is empty")

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset")

    if df[target_column].isnull().any():
        raise ValueError(f"Target column '{target_column}' contains null values")

    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]
    if not missing_cols.empty:
        logger.warning("Missing values detected:\n%s", missing_cols.to_string())
    else:
        logger.info("No missing values detected")

    dup_count = df.duplicated().sum()
    if dup_count > 0:
        logger.warning("Found %s duplicate row(s)", dup_count)
    else:
        logger.info("No duplicate rows detected")

    class_counts = df[target_column].value_counts()
    logger.info("Target distribution:\n%s", class_counts.to_string())

    for label in class_counts.index:
        if label not in CLASS_LABELS:
            logger.warning("Unexpected target label '%s'", label)

    if class_counts.min() < 2:
        raise ValueError("Each class must contain at least 2 samples for stratified splitting")


def log_invalid_ranges(df: pd.DataFrame) -> None:
    """Log any values that fall outside medically expected ranges.

    This is a soft check — no exception is raised.
    """
    checks = {
        "age": (18, 90),
        "height_cm": (140, 220),
        "weight_kg": (35, 160),
        "bmi": (14, 46),
        "heart_rate": (40, 190),
        "spo2": (75, 100),
        "sleep_hours": (2, 12),
        "stress_level": (0, 100),
        "heart_rate_variability": (10, 130),
    }

    for col, (low, high) in checks.items():
        if col not in df.columns:
            continue
        outside = df[(df[col] < low) | (df[col] > high)]
        if not outside.empty:
            logger.warning(
                "%s: %s value(s) outside expected range [%s, %s]",
                col, len(outside), low, high,
            )
