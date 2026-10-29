# Synthetic Healthcare Dataset — Cardiac Risk Prediction

## Overview

Generated synthetic dataset for training machine learning models to predict cardiac risk. Contains 25,000 patient records with 18 features spanning demographics, vitals, lifestyle, health conditions, GPS location, and a computed risk score.

**Purpose:** Academic research and ML model development for the Wearable Cardiac Risk Monitoring and Emergency Alert System.

**Disclaimer:** This is NOT real clinical data. Do not use for medical diagnosis.

---

## Column Descriptions

### Demographics

| Column | Type | Range | Description |
|---|---|---|---|
| `user_id` | string | `USER_00001` – `USER_25000` | Unique patient identifier |
| `age` | int | 18 – 90 | Patient age in years. Skewed toward middle-aged distribution. |
| `gender` | string | Male / Female | Binary gender (balanced ~50/50) |
| `height_cm` | float | 145 – 210 cm | Height by gender: Male ~N(175,8), Female ~N(162,7) |
| `weight_kg` | float | 40 – 150 kg | Weight with age-related trajectory (peaks ~55 years) |
| `bmi` | float | 15 – 45 | Body Mass Index = weight(kg) / height(m)² |

### Health Conditions

| Column | Type | Description |
|---|---|---|
| `smoking` | bool | Current smoker. Prevalence ~18%, higher in males. Influenced by age. |
| `diabetes` | bool | Diagnosed diabetes. Prevalence increases with age and BMI. |
| `hypertension` | bool | Diagnosed hypertension. Prevalence increases with age and BMI (strongest weight). |

Probabilities are computed as continuous functions of age and BMI, then thresholded to produce binary labels.

### Lifestyle

| Column | Type | Range | Description |
|---|---|---|---|
| `activity_level` | string | 4 levels | Sedentary / Lightly Active / Moderately Active / Very Active. Younger + lower BMI → more active. |
| `sleep_hours` | float | 3.0 – 10.0 hours | Daily sleep. Reduced by high stress; increased by high activity. |
| `stress_level` | int | 0 – 100 | Perceived stress score. Peaks in mid-life (30–50). Higher in sedentary individuals. |

### Vital Signs

| Column | Type | Range | Description |
|---|---|---|---|
| `heart_rate` | int | 45 – 180 BPM | Resting heart rate. Elevated by age, stress, smoking, hypertension, sedentary lifestyle. Lower in very active individuals. |
| `spo2` | float | 80 – 100 % | Blood oxygen saturation. Reduced by smoking, diabetes, age >60, high stress. |
| `heart_rate_variability` | int | 15 – 120 ms | HRV (RMSSD). Decreases with age, stress, smoking, hypertension. Increases with physical activity. |

### GPS Location

| Column | Type | Range | Description |
|---|---|---|---|
| `latitude` | float | 28.40 – 28.90 | GPS latitude (Delhi NCR region) |
| `longitude` | float | 76.80 – 77.40 | GPS longitude (Delhi NCR region) |

### Risk Labels

| Column | Type | Range | Description |
|---|---|---|---|
| `risk_score` | int | 0 – 100 | Normalized cardiac risk score. Higher = greater risk. |
| `risk_level` | string | Low / Medium / High | Categorical risk: 0–30 Low, 31–60 Medium, 61–100 High |

---

## Risk Score Calculation

The risk score is computed deterministically using weighted contributions from every feature:

| Component | Max Points | Thresholds |
|---|---|---|---|
| Age | 15 | ≥41:5, ≥61:10, ≥76:15 |
| Heart Rate | 15 | ≥81:3, ≥101:7, ≥121:11, ≥141:15 |
| SpO₂ | 20 | ≤96:5, ≤93:10, ≤91:15, ≤87:20 |
| BMI | 10 | ≥25 or ≤18.5:3, ≥30:7, ≥35:10 |
| Smoking | 10 | True → +10 |
| Diabetes | 10 | True → +10 |
| Hypertension | 15 | True → +15 |
| Stress | 10 | ≥31:2, ≥51:5, ≥76:10 |
| Sleep | 10 | <7h:3, <5h:7, <4h:10 |
| Activity | 10 | Sedentary:10, Lightly Active:5, Moderately Active:2 |
| HRV | 10 | <80ms:3, <50ms:7, <30ms:10 |

**Raw score** (capped at 100) → plus ±3 points Gaussian noise for realistic variation.

---

## Feature Correlations (Built-in)

| Relationship | Mechanism |
|---|---|
| Age → Hypertension | P(hypertension) increases with age |
| BMI → Diabetes | Higher BMI increases diabetes risk |
| Activity → BMI | Sedentary lifestyle correlates with higher BMI |
| Stress → Sleep | Higher stress reduces sleep hours |
| Activity → HRV | Active individuals have higher HRV |
| Smoking → HR, SpO₂ | Smokers have elevated HR and lower SpO₂ |
| Age → HRV | HRV naturally declines with age |
| Stress → HR | Acute stress elevates heart rate |

---

## Dataset Statistics (Actual from seed=42)

| Metric | Value |
|---|---|
| Records | 25,000 |
| Low risk (0–30) | 33.8% |
| Medium risk (31–60) | 58.1% |
| High risk (61–100) | 8.0% |
| Smokers | 18.5% |
| Diabetes | 10.9% |
| Hypertension | 21.8% |
| Mean risk score | 37.8 ± 15.2 |
| Risk score range | 0 – 100 |

---

## Usage

```python
import pandas as pd

df = pd.read_csv("dataset.csv")
print(df.shape)        # (25000, 18)
print(df.head())
print(df["risk_level"].value_counts())
```

### Train a classifier

```python
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

# Features (drop identifiers, GPS, and target)
X = df.drop(columns=["user_id", "risk_score", "risk_level", "latitude", "longitude"])
X = pd.get_dummies(X, columns=["gender", "activity_level"])

y = df["risk_level"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
print(f"Accuracy: {model.score(X_test, y_test):.3f}")
```

---

## Generator Script

Run `generate_dataset.py` to regenerate the dataset:

```bash
python generate_dataset.py
```

Parameters can be modified at the top of the script (constants section) or via the `generate_dataset(n=25000, seed=42)` function.
