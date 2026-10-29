"""Evaluation module for the cardiac risk ML pipeline.

Generates classification reports, confusion matrices, ROC curves,
feature importance plots, and cross-validation scores.
"""

from pathlib import Path
from typing import Dict, List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline

from config import (
    CLASSIFICATION_REPORT_PATH,
    CLASS_LABELS,
    CONFUSION_MATRIX_PATH,
    CV_FOLDS,
    FEATURE_IMPORTANCE_PATH,
    ROC_CURVE_PATH,
)
from logger import setup_logger

logger = setup_logger(__name__)


# ---------------------------------------------------------------------------
# Colour Palette
# ---------------------------------------------------------------------------

CMAP = "Blues"


# ---------------------------------------------------------------------------
# Metrics Calculation
# ---------------------------------------------------------------------------

def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray | None = None,
) -> Dict[str, float]:
    """Compute a comprehensive set of classification metrics.

    Parameters
    ----------
    y_true : np.ndarray
        Ground-truth encoded labels.
    y_pred : np.ndarray
        Predicted encoded labels.
    y_prob : np.ndarray | None, optional
        Predicted class probabilities (shape ``(n_samples, n_classes)``).
        Required for ROC-AUC.

    Returns
    -------
    Dict[str, float]
        Dictionary of metric names to values.
    """
    metrics = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision_weighted": round(float(precision_score(y_true, y_pred, average="weighted")), 4),
        "recall_weighted": round(float(recall_score(y_true, y_pred, average="weighted")), 4),
        "f1_weighted": round(float(f1_score(y_true, y_pred, average="weighted")), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, average="macro")), 4),
    }

    if y_prob is not None and y_prob.shape[1] == len(np.unique(y_true)):
        try:
            metrics["roc_auc_ovr"] = round(
                float(roc_auc_score(y_true, y_prob, multi_class="ovr")), 4,
            )
        except Exception as exc:
            logger.warning("ROC-AUC computation failed: %s", exc)

    return metrics


# ---------------------------------------------------------------------------
# Classification Report
# ---------------------------------------------------------------------------

def save_classification_report(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    target_names: List[str],
    path: str | Path = CLASSIFICATION_REPORT_PATH,
) -> str:
    """Generate and save a text classification report.

    Parameters
    ----------
    y_true : np.ndarray
        Ground-truth labels.
    y_pred : np.ndarray
        Predicted labels.
    target_names : List[str]
        Human-readable class names.
    path : str | Path
        Output file path.

    Returns
    -------
    str
        The generated report text.
    """
    report = classification_report(
        y_true, y_pred, target_names=target_names, digits=4,
    )
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(report, encoding="utf-8")

    logger.info("Classification report saved to %s", path)
    print("\n" + report)
    return report


# ---------------------------------------------------------------------------
# Confusion Matrix Plot
# ---------------------------------------------------------------------------

def plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: List[str],
    path: str | Path = CONFUSION_MATRIX_PATH,
) -> None:
    """Plot and save a confusion matrix heatmap.

    Parameters
    ----------
    y_true : np.ndarray
        Ground-truth labels.
    y_pred : np.ndarray
        Predicted labels.
    class_names : List[str]
        Human-readable class names.
    path : str | Path
        Output image path.
    """
    cm = confusion_matrix(y_true, y_pred)
    cm_normalized = cm.astype(float) / cm.sum(axis=1, keepdims=True)

    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm_normalized, interpolation="nearest", cmap=plt.get_cmap(CMAP))
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=np.arange(len(class_names)),
        yticks=np.arange(len(class_names)),
        xticklabels=class_names,
        yticklabels=class_names,
        xlabel="Predicted label",
        ylabel="True label",
        title="Normalised Confusion Matrix",
    )

    plt.setp(ax.get_xticklabels(), rotation=0, ha="center")

    thresh = cm_normalized.max() / 2.0
    for i in range(len(class_names)):
        for j in range(len(class_names)):
            text_color = "white" if cm_normalized[i, j] > thresh else "black"
            ax.text(
                j, i,
                f"{cm[i, j]}\n({cm_normalized[i, j]:.1%})",
                ha="center", va="center", color=text_color, fontsize=10,
            )

    fig.tight_layout()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(path), dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info("Confusion matrix saved to %s", path)


# ---------------------------------------------------------------------------
# ROC Curve Plot (One-vs-Rest)
# ---------------------------------------------------------------------------

def plot_roc_curves(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    class_names: List[str],
    path: str | Path = ROC_CURVE_PATH,
) -> None:
    """Plot and save ROC curves for each class using One-vs-Rest strategy.

    Parameters
    ----------
    y_true : np.ndarray
        Ground-truth encoded labels.
    y_prob : np.ndarray
        Predicted class probabilities.
    class_names : List[str]
        Human-readable class names.
    path : str | Path
        Output image path.
    """
    n_classes = len(class_names)
    y_true_bin = np.eye(n_classes)[y_true]

    fig, ax = plt.subplots(figsize=(8, 6))

    for i, name in enumerate(class_names):
        fpr, tpr, _ = roc_curve(y_true_bin[:, i], y_prob[:, i])
        auc = roc_auc_score(y_true_bin[:, i], y_prob[:, i])
        ax.plot(fpr, tpr, lw=2, label=f"{name} (AUC = {auc:.3f})")

    ax.plot([0, 1], [0, 1], "k--", lw=1, label="Random (AUC = 0.5)")
    ax.set(
        xlim=(0.0, 1.0),
        ylim=(0.0, 1.05),
        xlabel="False Positive Rate",
        ylabel="True Positive Rate",
        title="ROC Curves (One-vs-Rest)",
    )
    ax.legend(loc="lower right")
    ax.grid(alpha=0.3)

    fig.tight_layout()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(path), dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info("ROC curves saved to %s", path)


# ---------------------------------------------------------------------------
# Feature Importance Plot
# ---------------------------------------------------------------------------

def plot_feature_importance(
    model: object,
    feature_names: List[str],
    class_names: List[str],
    path: str | Path = FEATURE_IMPORTANCE_PATH,
    top_n: int = 20,
) -> None:
    """Plot and save feature importance / coefficient magnitudes.

    Handles:
    - Tree-based models (``feature_importances_``)
    - Linear models (``coef_`` absolute values, averaged across classes)

    Parameters
    ----------
    model : object
        A fitted classifier with either ``feature_importances_`` or ``coef_``.
    feature_names : List[str]
        Names of the transformed features.
    class_names : List[str]
        Human-readable class names.
    path : str | Path
        Output image path.
    top_n : int
        Number of top features to display.
    """
    importances: np.ndarray | None = None
    title: str = ""

    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        title = "Feature Importance (MDI)"
    elif hasattr(model, "coef_"):
        # Multi-class: average absolute coefficient across all classes
        importances = np.mean(np.abs(model.coef_), axis=0)
        title = "Feature Importance (Mean |Coefficient|)"

    if importances is None or len(importances) == 0:
        logger.warning("Model does not expose feature importances; skipping plot.")
        return

    feature_names = list(feature_names)

    if len(importances) != len(feature_names):
        logger.warning(
            "Importance length (%s) != feature name length (%s); truncating.",
            len(importances), len(feature_names),
        )
        min_len = min(len(importances), len(feature_names))
        importances = importances[:min_len]
        feature_names = feature_names[:min_len]

    indices = np.argsort(importances)[::-1][:top_n]

    fig, ax = plt.subplots(figsize=(10, max(6, top_n * 0.35)))
    y_pos = np.arange(len(indices))
    ax.barh(y_pos, importances[indices], align="center")
    ax.set_yticks(y_pos)
    ax.set_yticklabels([feature_names[i] for i in indices])
    ax.invert_yaxis()
    ax.set_xlabel("Importance")
    ax.set_title(title)
    ax.grid(axis="x", alpha=0.3)

    fig.tight_layout()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(path), dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info("Feature importance plot saved to %s", path)


# ---------------------------------------------------------------------------
# Cross-Validation
# ---------------------------------------------------------------------------

def cross_validate_model(
    pipeline: Pipeline,
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    cv: int = CV_FOLDS,
    scoring: str = "f1_weighted",
) -> Dict[str, float]:
    """Run k-fold cross-validation and return mean ± std of scores.

    Parameters
    ----------
    pipeline : Pipeline
        Scikit-learn pipeline (preprocessor + classifier).
    X_train : pd.DataFrame
        Training features.
    y_train : np.ndarray
        Training targets.
    cv : int
        Number of folds.
    scoring : str
        Scikit-learn scoring metric.

    Returns
    -------
    Dict[str, float]
        ``{"mean": ..., "std": ...}`` of the cross-validation scores.
    """
    logger.info("Running %s-fold cross-validation (scoring=%s) ...", cv, scoring)
    scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring=scoring)
    result = {
        "mean": round(float(scores.mean()), 4),
        "std": round(float(scores.std()), 4),
    }
    logger.info("CV %s: %.4f ± %.4f", scoring, result["mean"], result["std"])
    return result
