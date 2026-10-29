"""Training pipeline for the cardiac risk prediction model.

Loads the dataset, preprocesses features, trains multiple classifiers,
selects the best model based on F1 score, evaluates it, and saves
all artifacts for production deployment.
"""

import json
import time
from typing import Any, Dict

import joblib
import numpy as np
from sklearn.ensemble import (
    GradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score

from config import (
    CLASS_LABELS,
    DATASET_PATH,
    DECISION_TREE_PARAMS,
    DROP_COLUMNS,
    GRADIENT_BOOSTING_PARAMS,
    LOGISTIC_REGRESSION_PARAMS,
    METRICS_PATH,
    MODEL_COMPLEXITY,
    MODEL_PATH,
    MODELS_DIR,
    RANDOM_FOREST_PARAMS,
    RANDOM_SEED,
    TARGET_COLUMN,
    XGBOOST_PARAMS,
    F1_TOLERANCE,
    CV_FOLDS,
)
from evaluate import (
    compute_metrics,
    plot_confusion_matrix,
    plot_feature_importance,
    plot_roc_curves,
    save_classification_report,
)
from logger import setup_logger
from preprocess import Preprocessor
from utils import load_dataset, log_invalid_ranges, validate_dataset

logger = setup_logger(__name__)


# ---------------------------------------------------------------------------
# Model Registry
# ---------------------------------------------------------------------------

def _build_model_registry() -> Dict[str, Any]:
    """Build a dictionary of candidate model instances.

    XGBoost is included conditionally.
    """
    registry: Dict[str, Any] = {
        "LogisticRegression": LogisticRegression(**LOGISTIC_REGRESSION_PARAMS),
        "DecisionTree": DecisionTreeClassifier(**DECISION_TREE_PARAMS),
        "RandomForest": RandomForestClassifier(**RANDOM_FOREST_PARAMS),
        "GradientBoosting": GradientBoostingClassifier(**GRADIENT_BOOSTING_PARAMS),
    }
    try:
        import xgboost as xgb
        registry["XGBoost"] = xgb.XGBClassifier(**XGBOOST_PARAMS)
        logger.info("XGBoost is available – included in model comparison.")
    except ImportError:
        logger.info("XGBoost not installed – skipping.")
    return registry


# ---------------------------------------------------------------------------
# Model Selection Logic
# ---------------------------------------------------------------------------

def _select_best_model(results: Dict[str, Dict[str, float]]) -> str:
    """Select the best-performing model.

    Primary metric: **F1-weighted**.
    If two models are within ``F1_TOLERANCE``, the simpler model is preferred.
    """
    valid = {n: m for n, m in results.items() if "f1_weighted" in m}
    sorted_models = sorted(valid.items(), key=lambda x: x[1]["f1_weighted"], reverse=True)

    best_name, best_metrics = sorted_models[0]
    best_f1 = best_metrics["f1_weighted"]

    for name, metrics in sorted_models[1:]:
        f1 = metrics["f1_weighted"]
        if abs(f1 - best_f1) <= F1_TOLERANCE:
            if MODEL_COMPLEXITY.get(name, 99) < MODEL_COMPLEXITY.get(best_name, 99):
                logger.info(
                    "Models tied (F1=%.4f vs %.4f); preferring simpler '%s' over '%s'",
                    f1, best_f1, name, best_name,
                )
                best_name, best_f1 = name, f1
        else:
            break

    logger.info("Selected model: %s (F1 = %.4f)", best_name, best_f1)
    return best_name


# ---------------------------------------------------------------------------
# Main Training Orchestrator
# ---------------------------------------------------------------------------

def train_pipeline() -> str:
    """Execute the full training pipeline end-to-end.

    Returns
    -------
    str
        Name of the selected model.
    """
    start_time = time.time()
    logger.info("=" * 60)
    logger.info("TRAINING PIPELINE STARTED")
    logger.info("=" * 60)

    # ---- 1. Load & Validate ------------------------------------------------
    df = load_dataset(DATASET_PATH)
    validate_dataset(df, TARGET_COLUMN)
    log_invalid_ranges(df)
    df = df.drop(columns=[c for c in DROP_COLUMNS if c in df.columns], errors="ignore")
    logger.info("Dropped columns: %s", DROP_COLUMNS)

    # ---- 2. Preprocess -----------------------------------------------------
    preprocessor = Preprocessor()
    X_train, X_test, y_train, y_test = preprocessor.fit_transform(df, TARGET_COLUMN)
    feature_names = preprocessor.feature_columns
    class_names = CLASS_LABELS
    logger.info("Preprocessing done. Train: %s, Test: %s", X_train.shape, X_test.shape)

    # ---- 3. Train & Evaluate Models ----------------------------------------
    registry = _build_model_registry()
    results: Dict[str, Dict[str, float]] = {}
    fitted_models: Dict[str, Any] = {}

    logger.info("\n%s", "-" * 60)
    logger.info("Training %s model(s)...", len(registry))
    logger.info("%s", "-" * 60)

    for model_name, model in registry.items():
        logger.info(">>> Training: %s", model_name)

        model.fit(X_train, y_train)
        fitted_models[model_name] = model

        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)

        metrics = compute_metrics(y_test, y_pred, y_prob)

        # Cross-validation on already-transformed data
        cv_scores = cross_val_score(
            model.__class__(**model.get_params()),
            X_train, y_train,
            cv=CV_FOLDS,
            scoring="f1_weighted",
        )
        cv_mean = round(float(cv_scores.mean()), 4)
        cv_std = round(float(cv_scores.std()), 4)

        results[model_name] = {**metrics, "cv_f1_mean": cv_mean, "cv_f1_std": cv_std}

        logger.info(
            "  %s | Test F1: %.4f | Acc: %.4f | AUC: %.4f | CV F1: %.4f \u00b1 %.4f",
            model_name.ljust(20),
            metrics["f1_weighted"],
            metrics["accuracy"],
            metrics.get("roc_auc_ovr", 0.0),
            cv_mean,
            cv_std,
        )

    # ---- 4. Select Best Model ----------------------------------------------
    selected_name = _select_best_model(results)
    selected_model = fitted_models[selected_name]

    logger.info("\n" + "=" * 60)
    logger.info("BEST MODEL: %s", selected_name)
    logger.info("=" * 60)

    # ---- 5. Retrain on Full Dataset ----------------------------------------
    logger.info("Retraining '%s' on full dataset ...", selected_name)
    preprocessor_full = Preprocessor()
    X_full, y_full = preprocessor_full.fit_transform_full(df, TARGET_COLUMN)

    final_model = selected_model.__class__(**selected_model.get_params())
    final_model.fit(X_full, y_full)

    final_pipeline = Pipeline([
        ("preprocessor", preprocessor_full.transformer),
        ("classifier", final_model),
    ])

    # ---- 6. Final Evaluation on Test Set -----------------------------------
    logger.info("Final evaluation on held-out test set ...")
    y_pred_final = selected_model.predict(X_test)
    y_prob_final = selected_model.predict_proba(X_test)

    final_metrics = compute_metrics(y_test, y_pred_final, y_prob_final)

    cv_final = cross_val_score(
        selected_model.__class__(**selected_model.get_params()),
        X_train, y_train,
        cv=CV_FOLDS,
        scoring="f1_weighted",
    )
    cv_final_mean = round(float(cv_final.mean()), 4)
    cv_final_std = round(float(cv_final.std()), 4)

    full_results = {
        "selected_model": selected_name,
        "test_metrics": final_metrics,
        "cross_validation": {
            "folds": CV_FOLDS,
            "f1_weighted_mean": cv_final_mean,
            "f1_weighted_std": cv_final_std,
        },
        "training_records": len(df),
        "feature_count": len(feature_names),
        "all_model_results": {
            name: {k: v for k, v in m.items()}
            for name, m in results.items()
        },
    }

    # ---- 7. Save Artifacts -------------------------------------------------
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_pipeline, MODEL_PATH)
    logger.info("Model pipeline saved -> %s", MODEL_PATH)

    preprocessor_full.save_artifacts()

    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(full_results, f, indent=2)
    logger.info("Metrics saved -> %s", METRICS_PATH)

    # ---- 8. Generate Reports -----------------------------------------------
    save_classification_report(y_test, y_pred_final, class_names)
    plot_confusion_matrix(y_test, y_pred_final, class_names)
    if y_prob_final is not None:
        plot_roc_curves(y_test, y_prob_final, class_names)
    plot_feature_importance(final_model, preprocessor_full.feature_columns, class_names)

    elapsed = time.time() - start_time
    logger.info("=" * 60)
    logger.info("PIPELINE COMPLETED in %.2f seconds", elapsed)
    logger.info("=" * 60)

    print("\n" + "=" * 60)
    print("TRAINING SUMMARY")
    print("=" * 60)
    print(f"  Best model:          {selected_name}")
    print(f"  Test Accuracy:       {final_metrics['accuracy']:.4f}")
    print(f"  F1 (weighted):       {final_metrics['f1_weighted']:.4f}")
    print(f"  ROC-AUC (OvR):       {final_metrics.get('roc_auc_ovr', 0.0):.4f}")
    print(f"  CV F1 ({CV_FOLDS}-fold):      {cv_final_mean:.4f} ± {cv_final_std:.4f}")
    print(f"  Training time:       {elapsed:.2f}s")
    print("=" * 60)

    return selected_name


if __name__ == "__main__":
    train_pipeline()
