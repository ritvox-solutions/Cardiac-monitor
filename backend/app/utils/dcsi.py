"""Daily Cardiac Stress Index (DCSI) calculator.

Formula
-------
DCSI = 0.35 * HR_Score + 0.25 * SpO2_Score + 0.20 * HRV_Score + 0.20 * Activity_Score

All sub-scores are normalised to 0–100 (higher = worse).
The final DCSI is also reported on a 0–100 scale.

Risk interpretation
-------------------
  0–30   Healthy
 31–60   Moderate
 61–80   High
 81–100  Critical
"""

from enum import Enum


# ---------------------------------------------------------------------------
# Activity-level ordinal mapping
# ---------------------------------------------------------------------------

class ActivityLevel(str, Enum):
    SEDENTARY = "Sedentary"
    LIGHTLY_ACTIVE = "Lightly Active"
    MODERATELY_ACTIVE = "Moderately Active"
    VERY_ACTIVE = "Very Active"


_ACTIVITY_SCORES = {
    ActivityLevel.SEDENTARY: 100,
    ActivityLevel.LIGHTLY_ACTIVE: 66,
    ActivityLevel.MODERATELY_ACTIVE: 33,
    ActivityLevel.VERY_ACTIVE: 0,
}


# ---------------------------------------------------------------------------
# Sub-score calculators
# ---------------------------------------------------------------------------

def _heart_rate_score(hr: float) -> float:
    """Score heart rate on 0–100 (higher = worse).

    Ideal resting range: 60–100 BPM.
    """
    if 60 <= hr <= 100:
        return 0.0
    if hr < 60:
        return (60 - hr) / 20 * 30  # 40 BPM → 30, 60 BPM → 0
    # hr > 100
    if hr > 140:
        return 100.0
    return (hr - 100) / 40 * 100


def _spo2_score(spo2: float) -> float:
    """Score SpO₂ on 0–100 (higher = worse).

    Normal: ≥95%.  Critical: <90%.
    """
    if spo2 >= 95:
        return max(0.0, (95 - spo2) / 5 * 20)  # 95→0, 100→0
    if spo2 < 90:
        return 100.0
    return (95 - spo2) / 5 * 100  # 95→0, 90→100


def _hrv_score(hrv: float) -> float:
    """Score HRV on 0–100 (higher = worse).

    Higher HRV is healthier.  Typical range 15–120 ms.
    """
    if hrv >= 80:
        return 0.0
    if hrv < 30:
        return 100.0
    return (80 - hrv) / 50 * 100  # 80→0, 30→100


def _activity_score(activity_str: str) -> float:
    """Score activity level on 0–100 (higher = worse)."""
    try:
        level = ActivityLevel(activity_str)
    except ValueError:
        return 50.0  # default to moderate for unrecognised values
    return float(_ACTIVITY_SCORES[level])


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_dcsi(
    heart_rate: float,
    spo2: float,
    heart_rate_variability: float,
    activity_level: str,
) -> float:
    """Compute the Daily Cardiac Stress Index.

    Parameters
    ----------
    heart_rate : float
        Heart rate in BPM.
    spo2 : float
        Blood oxygen saturation percentage.
    heart_rate_variability : float
        HRV in milliseconds.
    activity_level : str
        One of: Sedentary, Lightly Active, Moderately Active, Very Active.

    Returns
    -------
    float
        DCSI score normalised to 0–100.
    """
    hr_s = _heart_rate_score(heart_rate)
    spo2_s = _spo2_score(spo2)
    hrv_s = _hrv_score(heart_rate_variability)
    act_s = _activity_score(activity_level)

    dcsi = 0.35 * hr_s + 0.25 * spo2_s + 0.20 * hrv_s + 0.20 * act_s
    return round(dcsi, 2)
