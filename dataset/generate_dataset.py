"""
Synthetic Healthcare Dataset Generator for Cardiac Risk Prediction.

Generates a realistic synthetic dataset of 25,000 patient records with
vital signs, lifestyle factors, and computed cardiac risk scores.

Designed for training:
  - Logistic Regression
  - Decision Tree
  - Random Forest
  - XGBoost

DISCLAIMER: This is synthetic data for academic/research purposes only.
It is NOT a substitute for real clinical data or medical diagnosis.
"""

import os
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RANDOM_SEED = 42
N_RECORDS = 25_000

AGE_MIN = 18
AGE_MAX = 90

HR_MIN = 45
HR_MAX = 180

SPO2_MIN = 80.0
SPO2_MAX = 100.0

HRV_MIN = 15
HRV_MAX = 120

BMI_MIN = 15.0
BMI_MAX = 45.0

SLEEP_MIN = 3.0
SLEEP_MAX = 10.0

STRESS_MIN = 0
STRESS_MAX = 100

ACTIVITY_LEVELS = ("Sedentary", "Lightly Active", "Moderately Active", "Very Active")
ACTIVITY_PROBS = (0.25, 0.30, 0.30, 0.15)

LAT_MIN, LAT_MAX = 28.40, 28.90
LON_MIN, LON_MAX = 76.80, 77.40

RISK_MIN = 0
RISK_MAX = 100

MAX_RAW_SCORE = 100


# ---------------------------------------------------------------------------
# Demographic Generation
# ---------------------------------------------------------------------------

def generate_user_ids(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate unique user identifiers."""
    return np.array([f"USER_{i:05d}" for i in range(1, n + 1)])


def generate_ages(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate ages using a beta distribution skewed toward younger ages."""
    raw = rng.beta(2.0, 2.5, n)
    return (raw * (AGE_MAX - AGE_MIN) + AGE_MIN).astype(int)


def generate_genders(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate gender labels with balanced distribution."""
    return rng.choice(["Male", "Female"], n, p=[0.50, 0.50])


def generate_heights(n: int, genders: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate height by gender with realistic means and spreads."""
    height = np.zeros(n, dtype=float)
    male = genders == "Male"
    female = ~male
    height[male] = rng.normal(175, 8, male.sum())
    height[female] = rng.normal(162, 7, female.sum())
    return np.clip(height, 145, 210).round(1)


def generate_weights(n: int, ages: np.ndarray, genders: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate weight with age-related trajectory (peaks in middle age)."""
    weight = np.zeros(n, dtype=float)
    male = genders == "Male"
    female = ~male
    weight[male] = rng.normal(75, 12, male.sum())
    weight[female] = rng.normal(65, 11, female.sum())
    age_peak = 55
    age_factor = np.where(
        ages <= age_peak,
        (ages - AGE_MIN) / (age_peak - AGE_MIN),
        (AGE_MAX - ages) / (AGE_MAX - age_peak),
    )
    weight += (age_factor - 0.3) * 8
    return np.clip(weight, 40, 150).round(1)


def compute_bmi(weights: np.ndarray, heights: np.ndarray) -> np.ndarray:
    """Compute BMI from weight (kg) and height (cm)."""
    bmi = weights / ((heights / 100.0) ** 2)
    return np.clip(bmi, BMI_MIN, BMI_MAX).round(1)


def generate_demographics(n: int, rng: np.random.Generator) -> pd.DataFrame:
    """Generate all demographic features."""
    df = pd.DataFrame(index=range(n))
    df["user_id"] = generate_user_ids(n, rng)
    df["age"] = generate_ages(n, rng)
    df["gender"] = generate_genders(n, rng)
    df["height_cm"] = generate_heights(n, df["gender"].values, rng)
    df["weight_kg"] = generate_weights(n, df["age"].values, df["gender"].values, rng)
    df["bmi"] = compute_bmi(df["weight_kg"].values, df["height_cm"].values)
    return df


# ---------------------------------------------------------------------------
# Health Condition Generation
# ---------------------------------------------------------------------------

def generate_smoking(ages: np.ndarray, genders: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate smoking status with age and gender influence."""
    prob = 0.05 + (ages / AGE_MAX) * 0.20
    prob[genders == "Male"] = np.clip(prob[genders == "Male"] + 0.05, 0, 0.50)
    return rng.random(len(ages)) < prob


def generate_diabetes(ages: np.ndarray, bmis: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate diabetes status with age and BMI influence."""
    prob = 0.01 + (ages / AGE_MAX) * 0.15 + np.maximum(0, (bmis - 25)) * 0.008
    prob = np.clip(prob, 0, 0.55)
    return rng.random(len(ages)) < prob


def generate_hypertension(ages: np.ndarray, bmis: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate hypertension status with age and BMI influence."""
    prob = 0.05 + (ages / AGE_MAX) * 0.25 + np.maximum(0, (bmis - 25)) * 0.012
    prob = np.clip(prob, 0, 0.70)
    return rng.random(len(ages)) < prob


def generate_health_conditions(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Generate all health condition features."""
    df["smoking"] = generate_smoking(df["age"].values, df["gender"].values, rng)
    df["diabetes"] = generate_diabetes(df["age"].values, df["bmi"].values, rng)
    df["hypertension"] = generate_hypertension(df["age"].values, df["bmi"].values, rng)
    return df


# ---------------------------------------------------------------------------
# Lifestyle Generation
# ---------------------------------------------------------------------------

def generate_activity_levels(ages: np.ndarray, bmis: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate activity level influenced by age and BMI."""
    n = len(ages)
    probs = np.tile(list(ACTIVITY_PROBS), (n, 1)).astype(float)
    age_penalty = np.clip((ages - 40) / 50, 0, 0.3)
    bmi_penalty = np.clip((bmis - 30) / 15, 0, 0.2)
    probs[:, 0] += age_penalty + bmi_penalty
    probs[:, 3] -= age_penalty + bmi_penalty
    probs = np.clip(probs, 0.01, 1.0)
    probs /= probs.sum(axis=1, keepdims=True)
    return np.array([rng.choice(list(ACTIVITY_LEVELS), p=p) for p in probs])


def generate_stress_levels(ages: np.ndarray, activities: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate stress level with mid-career peak and activity influences."""
    stress = rng.normal(45, 15, len(ages))
    stress += 15 * np.exp(-((ages - 40) ** 2) / (2 * 15 ** 2))
    stress += (activities == "Sedentary").astype(float) * 8
    return np.clip(np.round(stress).astype(int), STRESS_MIN, STRESS_MAX)


def generate_sleep_hours(stress: np.ndarray, activities: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Generate sleep hours influenced by stress and activity level."""
    sleep = rng.normal(7.0, 1.2, len(stress))
    sleep -= (stress / 100.0) * 1.5
    sleep += (activities == "Very Active").astype(float) * 0.5
    sleep -= (activities == "Sedentary").astype(float) * 0.5
    return np.clip(sleep, SLEEP_MIN, SLEEP_MAX).round(1)


def generate_lifestyle(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Generate all lifestyle features."""
    df["activity_level"] = generate_activity_levels(df["age"].values, df["bmi"].values, rng)
    df["stress_level"] = generate_stress_levels(df["age"].values, df["activity_level"].values, rng)
    df["sleep_hours"] = generate_sleep_hours(df["stress_level"].values, df["activity_level"].values, rng)
    return df


# ---------------------------------------------------------------------------
# Vital Sign Generation
# ---------------------------------------------------------------------------

def generate_heart_rate(
    ages: np.ndarray, stress: np.ndarray, activities: np.ndarray,
    smoking: np.ndarray, hypertension: np.ndarray, rng: np.random.Generator,
) -> np.ndarray:
    """Generate heart rate influenced by age, stress, activity, smoking, hypertension."""
    hr = rng.normal(72, 8, len(ages))
    hr += np.clip((ages - 40) / 50, 0, 1) * 5
    hr += smoking.astype(int) * 8
    hr += hypertension.astype(int) * 5
    hr += (stress / 100.0) * 10
    hr += (activities == "Sedentary").astype(int) * 5
    hr -= (activities == "Very Active").astype(int) * 5
    hr += rng.normal(0, 3, len(ages))
    return np.clip(np.round(hr).astype(int), HR_MIN, HR_MAX)


def generate_spo2(
    ages: np.ndarray, stress: np.ndarray,
    smoking: np.ndarray, diabetes: np.ndarray, rng: np.random.Generator,
) -> np.ndarray:
    """Generate SpO2 influenced by age, smoking, diabetes, and stress."""
    spo2 = rng.normal(98, 1.0, len(ages))
    spo2 -= smoking.astype(int) * 1.5
    spo2 -= diabetes.astype(int) * 1.0
    spo2 -= np.clip((ages - 60) / 30, 0, 1) * 1.5
    spo2 -= (stress / 100.0) * 1.0
    spo2 += rng.normal(0, 0.5, len(ages))
    return np.clip(spo2, SPO2_MIN, SPO2_MAX).round(1)


def generate_hrv(
    ages: np.ndarray, stress: np.ndarray, activities: np.ndarray,
    smoking: np.ndarray, hypertension: np.ndarray, rng: np.random.Generator,
) -> np.ndarray:
    """Generate heart rate variability influenced by age, fitness, stress, smoking."""
    hrv = rng.normal(65, 15, len(ages))
    hrv -= (ages / AGE_MAX) * 25
    hrv -= smoking.astype(int) * 8
    hrv -= (stress / 100.0) * 15
    hrv -= hypertension.astype(int) * 5
    hrv += (activities == "Very Active").astype(int) * 10
    hrv -= (activities == "Sedentary").astype(int) * 8
    hrv += rng.normal(0, 5, len(ages))
    return np.clip(np.round(hrv).astype(int), HRV_MIN, HRV_MAX)


def generate_vitals(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Generate all vital sign features."""
    a = df["age"].values
    s = df["stress_level"].values
    act = df["activity_level"].values
    smk = df["smoking"].values
    hyp = df["hypertension"].values
    dia = df["diabetes"].values
    df["heart_rate"] = generate_heart_rate(a, s, act, smk, hyp, rng)
    df["spo2"] = generate_spo2(a, s, smk, dia, rng)
    df["heart_rate_variability"] = generate_hrv(a, s, act, smk, hyp, rng)
    return df


# ---------------------------------------------------------------------------
# GPS Generation
# ---------------------------------------------------------------------------

def generate_gps(n: int, rng: np.random.Generator) -> pd.DataFrame:
    """Generate GPS coordinates within the Delhi NCR bounding box."""
    return pd.DataFrame({
        "latitude": rng.uniform(LAT_MIN, LAT_MAX, n).round(6),
        "longitude": rng.uniform(LON_MIN, LON_MAX, n).round(6),
    })


# ---------------------------------------------------------------------------
# Risk Score Calculation
# ---------------------------------------------------------------------------

def _age_risk(age: np.ndarray) -> np.ndarray:
    return np.select([age >= 76, age >= 61, age >= 41], [15, 10, 5], default=0)


def _heart_rate_risk(hr: np.ndarray) -> np.ndarray:
    return np.select(
        [hr >= 141, hr >= 121, hr >= 101, hr >= 81],
        [15, 11, 7, 3],
        default=0,
    )


def _spo2_risk(spo2: np.ndarray) -> np.ndarray:
    return np.select(
        [spo2 <= 87, spo2 <= 91, spo2 <= 93, spo2 <= 96],
        [20, 15, 10, 5],
        default=0,
    )


def _bmi_risk(bmi: np.ndarray) -> np.ndarray:
    return np.select(
        [bmi >= 35, bmi >= 30, bmi >= 25, bmi <= 18.5],
        [10, 7, 3, 3],
        default=0,
    )


def _stress_risk(stress: np.ndarray) -> np.ndarray:
    return np.select([stress >= 76, stress >= 51, stress >= 31], [10, 5, 2], default=0)


def _sleep_risk(sleep: np.ndarray) -> np.ndarray:
    return np.select([sleep < 4, sleep < 5, sleep < 7], [10, 7, 3], default=0)


def _activity_risk(activities: np.ndarray) -> np.ndarray:
    return np.select(
        [activities == "Sedentary", activities == "Lightly Active", activities == "Moderately Active"],
        [10, 5, 2],
        default=0,
    )


def _hrv_risk(hrv: np.ndarray) -> np.ndarray:
    return np.select([hrv < 30, hrv < 50, hrv < 80], [10, 7, 3], default=0)


def calculate_risk_scores(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Calculate risk scores using rule-based clinical logic.

    Each feature contributes weighted points toward a total raw score (max 135),
    which is normalized to a 0-100 scale. Small Gaussian noise (±3) is added
    for realistic variation.
    """
    score = np.zeros(len(df), dtype=float)

    score += _age_risk(df["age"].values)
    score += _heart_rate_risk(df["heart_rate"].values)
    score += _spo2_risk(df["spo2"].values)
    score += _bmi_risk(df["bmi"].values)
    score += df["smoking"].values.astype(int) * 10
    score += df["diabetes"].values.astype(int) * 10
    score += df["hypertension"].values.astype(int) * 15
    score += _stress_risk(df["stress_level"].values)
    score += _sleep_risk(df["sleep_hours"].values)
    score += _activity_risk(df["activity_level"].values)
    score += _hrv_risk(df["heart_rate_variability"].values)

    risk_score = (score / MAX_RAW_SCORE) * 100
    noise = rng.normal(0, 3, len(df))
    risk_score = np.clip(np.round(risk_score + noise), RISK_MIN, RISK_MAX).astype(int)

    df["risk_score"] = risk_score

    df["risk_level"] = np.select(
        [risk_score <= 30, risk_score <= 60],
        ["Low", "Medium"],
        default="High",
    )

    return df


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------

def generate_dataset(n: int = N_RECORDS, seed: int = RANDOM_SEED) -> pd.DataFrame:
    """Generate the complete synthetic healthcare dataset.

    Parameters
    ----------
    n : int, optional
        Number of records to generate (default 25,000).
    seed : int, optional
        Random seed for reproducibility (default 42).

    Returns
    -------
    pd.DataFrame
        Complete dataset with 18 features and risk labels.
    """
    rng = np.random.default_rng(seed)
    print(f"Generating {n:,} synthetic patient records (seed={seed})...")

    df = generate_demographics(n, rng)
    print("  Demographics generated.")

    df = generate_health_conditions(df, rng)
    print("  Health conditions generated.")

    df = generate_lifestyle(df, rng)
    print("  Lifestyle features generated.")

    df = generate_vitals(df, rng)
    print("  Vital signs generated.")

    gps = generate_gps(n, rng)
    df["latitude"] = gps["latitude"]
    df["longitude"] = gps["longitude"]
    print("  GPS coordinates generated.")

    df = calculate_risk_scores(df, rng)
    print("  Risk scores calculated.")

    return df


def print_validation_report(df: pd.DataFrame) -> None:
    """Print a comprehensive dataset validation report."""
    print("\n" + "=" * 60)
    print("DATASET VALIDATION REPORT")
    print("=" * 60)
    print(f"  Records:          {len(df):,}")
    print(f"  Columns:          {len(df.columns)}")
    print(f"  Missing values:   {df.isnull().sum().sum()}")
    print(f"  Duplicates:       {df.duplicated().sum()}")

    print("\nRisk Level Distribution:")
    dist = df["risk_level"].value_counts()
    for level in ["Low", "Medium", "High"]:
        c = dist.get(level, 0)
        print(f"  {level:>8}: {c:>6,} ({c / len(df) * 100:.1f}%)")

    print("\nRisk Score Summary:")
    rs = df["risk_score"]
    print(f"  Mean ± SD:  {rs.mean():.1f} ± {rs.std():.1f}")
    print(f"  Median:     {rs.median():.1f}")
    print(f"  Range:      {rs.min()} – {rs.max()}")

    print("\nContinuous Feature Ranges:")
    for col in ["age", "bmi", "heart_rate", "spo2", "sleep_hours", "stress_level", "heart_rate_variability"]:
        print(f"  {col:>24}: {df[col].min():>8} – {df[col].max():<8}  (mean={df[col].mean():.1f})")

    print("\nCategorical Distributions:")
    print(f"  {'gender':>24}: {df['gender'].value_counts().to_dict()}")

    print("\nCondition Prevalence:")
    for cond in ["smoking", "diabetes", "hypertension"]:
        print(f"  {cond:>24}: {df[cond].mean() * 100:.1f}%")

    print("\nActivity Level Distribution:")
    act_dist = df["activity_level"].value_counts()
    for act in ACTIVITY_LEVELS:
        c = act_dist.get(act, 0)
        print(f"  {act:>24}: {c:>6,} ({c / len(df) * 100:.1f}%)")


def export_dataset(df: pd.DataFrame, output_dir: str = "dataset", filename: str = "dataset.csv") -> str:
    """Export dataset to CSV file.

    Parameters
    ----------
    df : pd.DataFrame
        The dataset to export.
    output_dir : str, optional
        Output directory (default 'dataset').
    filename : str, optional
        Output filename (default 'dataset.csv').

    Returns
    -------
    str
        Path to the saved CSV file.
    """
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, filename)
    df.to_csv(path, index=False)
    print(f"\nDataset saved: {path} ({os.path.getsize(path) / 1e6:.2f} MB)")
    return path


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    dataset = generate_dataset(n=N_RECORDS, seed=RANDOM_SEED)
    print_validation_report(dataset)
    export_dataset(dataset)
    print("\nDone.")
