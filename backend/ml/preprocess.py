"""Preprocessing pipeline for the cardiac risk dataset.

Handles categorical encoding, numerical scaling, target encoding,
and persistence of all preprocessing artifacts.
"""

from pathlib import Path
from typing import List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler

from config import (
    BINARY_FEATURES,
    CATEGORICAL_FEATURES,
    CLASS_LABELS,
    ENCODER_PATH,
    FEATURE_COLUMNS_PATH,
    NUMERIC_FEATURES,
    RANDOM_SEED,
    SCALER_PATH,
    TEST_SIZE,
)
from logger import setup_logger

logger = setup_logger(__name__)


# ---------------------------------------------------------------------------
# Preprocessor Builder
# ---------------------------------------------------------------------------

def build_column_transformer() -> ColumnTransformer:
    """Construct a ColumnTransformer for the feature matrix.

    - Numeric features  → ``StandardScaler``
    - Categorical features → ``OneHotEncoder`` (drop first level)
    - Binary features    → passthrough (already 0 / 1)

    Returns
    -------
    ColumnTransformer
        Unfitted transformer ready to be ``.fit()``.
    """
    numeric_pipeline = StandardScaler()
    categorical_pipeline = OneHotEncoder(
        drop="first",
        sparse_output=False,
        handle_unknown="ignore",
    )

    transformer = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, list(NUMERIC_FEATURES)),
            ("cat", categorical_pipeline, list(CATEGORICAL_FEATURES)),
            ("bin", "passthrough", list(BINARY_FEATURES)),
        ],
        verbose_feature_names_out=False,
    )
    return transformer


# ---------------------------------------------------------------------------
# Feature Name Extraction
# ---------------------------------------------------------------------------

def _extract_feature_names(
    transformer: ColumnTransformer,
) -> List[str]:
    """Extract output feature names from a fitted ColumnTransformer.

    Parameters
    ----------
    transformer : ColumnTransformer
        Fitted column transformer.

    Returns
    -------
    List[str]
        Human-readable feature names in column order.
    """
    names: List[str] = []

    for name, step, columns in transformer.transformers_:
        if step == "drop" or step is None:
            continue

        if name == "num":
            names.extend(NUMERIC_FEATURES)
        elif name == "cat":
            encoder: OneHotEncoder = step
            input_features = CATEGORICAL_FEATURES
            for i, col in enumerate(input_features):
                cats = encoder.categories_[i][1:]  # drop='first' → skip index 0
                for cat in cats:
                    names.append(f"{col}_{cat}")
        elif name == "bin":
            names.extend(BINARY_FEATURES)
        else:
            names.extend(list(columns))

    return names


# ---------------------------------------------------------------------------
# Main Preprocessing Class
# ---------------------------------------------------------------------------

class Preprocessor:
    """Encapsulates all preprocessing logic for the cardiac dataset.

    Usage
    -----
    >>> prep = Preprocessor()
    >>> X_train, X_test, y_train, y_test = prep.fit_transform(raw_df, target_col)
    >>> prep.save_artifacts()
    """

    def __init__(self) -> None:
        self.transformer: ColumnTransformer | None = None
        self.label_encoder: LabelEncoder = LabelEncoder()
        self.feature_columns: List[str] = []

    # ---- Fit & Transform -------------------------------------------------

    def fit_transform(
        self,
        df: pd.DataFrame,
        target_column: str,
    ) -> Tuple[pd.DataFrame, pd.DataFrame, np.ndarray, np.ndarray]:
        """Fit the preprocessor and return train/test splits.

        Parameters
        ----------
        df : pd.DataFrame
            Raw dataset.
        target_column : str
            Name of the target column.

        Returns
        -------
        Tuple of (X_train, X_test, y_train, y_test).
        """
        logger.info("Starting preprocessing pipeline")

        X = df.drop(columns=[target_column])
        y = df[target_column]

        X_train_raw, X_test_raw, y_train, y_test = train_test_split(
            X, y,
            test_size=TEST_SIZE,
            random_state=RANDOM_SEED,
            stratify=y,
        )

        logger.info(
            "Train/test split: %s train / %s test",
            len(X_train_raw), len(X_test_raw),
        )

        self.transformer = build_column_transformer()
        self.transformer.fit(X_train_raw)

        self.feature_columns = _extract_feature_names(self.transformer)
        logger.info("Feature columns after transformation: %s", len(self.feature_columns))

        X_train = self.transform(X_train_raw)
        X_test = self.transform(X_test_raw)

        y_train_encoded = self.label_encoder.fit_transform(y_train)
        y_test_encoded = self.label_encoder.transform(y_test)

        logger.info("Encoded target classes: %s", self.label_encoder.classes_.tolist())

        return X_train, X_test, y_train_encoded, y_test_encoded

    def fit_transform_full(
        self,
        df: pd.DataFrame,
        target_column: str,
    ) -> Tuple[pd.DataFrame, np.ndarray]:
        """Fit preprocessor on the **full** dataset (no split).

        Used when retraining the selected model on all available data
        before deployment.
        """
        X = df.drop(columns=[target_column])
        y = df[target_column]

        self.transformer = build_column_transformer()
        self.transformer.fit(X)
        self.feature_columns = _extract_feature_names(self.transformer)

        X_transformed = self.transform(X)
        y_encoded = self.label_encoder.fit_transform(y)

        logger.info("Fit preprocessor on full dataset (%s rows)", len(df))
        return X_transformed, y_encoded

    # ---- Transform Only --------------------------------------------------

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Apply the fitted transformation to new data.

        Parameters
        ----------
        X : pd.DataFrame
            Raw feature matrix.

        Returns
        -------
        pd.DataFrame
            Transformed feature matrix with named columns.
        """
        if self.transformer is None:
            raise RuntimeError("Transformer has not been fitted yet. Call fit_transform() first.")

        data = self.transformer.transform(X)
        return pd.DataFrame(data, columns=self.feature_columns, index=X.index)

    def encode_target(self, y: pd.Series | np.ndarray) -> np.ndarray:
        """Encode target labels to integers.

        Parameters
        ----------
        y : pd.Series | np.ndarray
            Raw target labels.

        Returns
        -------
        np.ndarray
            Encoded integer labels.
        """
        return self.label_encoder.transform(y)

    def decode_target(self, y: np.ndarray) -> np.ndarray:
        """Decode integer labels back to original strings.

        Parameters
        ----------
        y : np.ndarray
            Encoded integer labels.

        Returns
        -------
        np.ndarray
            Original string labels.
        """
        return self.label_encoder.inverse_transform(y)

    # ---- Persistence -----------------------------------------------------

    def save_artifacts(self) -> None:
        """Save the transformer, label encoder, and feature column names to disk."""
        if self.transformer is None:
            raise RuntimeError("No fitted artifacts to save. Call fit_transform() first.")

        SCALER_PATH.parent.mkdir(parents=True, exist_ok=True)

        joblib.dump(self.transformer, SCALER_PATH)
        joblib.dump(self.label_encoder, ENCODER_PATH)
        joblib.dump(self.feature_columns, FEATURE_COLUMNS_PATH)

        logger.info("Preprocessing artifacts saved:")
        logger.info("  Transformer     -> %s", SCALER_PATH)
        logger.info("  Label encoder   -> %s", ENCODER_PATH)
        logger.info("  Feature columns -> %s", FEATURE_COLUMNS_PATH)

    @staticmethod
    def load_artifacts() -> "Preprocessor":
        """Load a previously fitted Preprocessor from disk.

        Returns
        -------
        Preprocessor
            A Preprocessor instance with loaded artifacts.
        """
        prep = Preprocessor()
        prep.transformer = joblib.load(SCALER_PATH)
        prep.label_encoder = joblib.load(ENCODER_PATH)
        prep.feature_columns = joblib.load(FEATURE_COLUMNS_PATH)

        logger.info("Preprocessing artifacts loaded from %s", SCALER_PATH.parent)
        return prep
