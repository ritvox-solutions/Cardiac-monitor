# Cardiac Risk Monitoring — Backend API

FastAPI backend for the **Wearable Cardiac Risk Monitoring and Emergency Alert System**. Acts as the central server between the React Native mobile app, the ESP32 wearable device, the ML model, and PostgreSQL.

> For the full end-to-end data pipeline and the current list of wiring gaps, see [`../docs/INTEGRATION.md`](../docs/INTEGRATION.md).

---

## Quick Start

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env if your PostgreSQL is not at localhost:5432

# 3. Start the server
uvicorn app.main:app --reload --port 8000
```

Open [http://localhost:8000/docs](http://localhost:8000/docs) for the Swagger UI.

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory, lifespan, CORS
│   ├── api/
│   │   ├── dependencies.py     # Dependency injection (DB, services)
│   │   └── routes/
│   │       ├── health.py       # GET /health
│   │       ├── prediction.py   # POST /predict
│   │       ├── sensor.py       # POST /sensor-data
│   │       ├── dashboard.py    # GET /dashboard/{id}, GET /history/{id}
│   │       └── emergency.py    # POST /emergency
│   ├── core/
│   │   ├── config.py           # Pydantic Settings (env-based)
│   │   └── logger.py           # Centralised logging
│   ├── database/
│   │   └── postgres.py         # Async SQLAlchemy engine, connection lifecycle
│   ├── models/
│   │   └── postgres_models.py  # SQLAlchemy ORM table definitions
│   ├── schemas/
│   │   ├── health.py
│   │   ├── prediction.py       # PredictionInput / PredictionOutput
│   │   ├── sensor.py
│   │   ├── dashboard.py
│   │   └── emergency.py
│   ├── services/
│   │   ├── prediction_service.py  # ML pipeline wrapper + DCSI
│   │   ├── sensor_service.py      # Sensor data CRUD
│   │   ├── dashboard_service.py   # Dashboard/history aggregation
│   │   └── emergency_service.py   # Alert management
│   ├── utils/
│   │   └── dcsi.py             # Daily Cardiac Stress Index calculator
│   └── ml/                     # Trained model artifacts (copied from trained_models/)
├── tests/
│   └── test_routes.py          # Smoke tests for all endpoints
├── trained_models/             # Training output (not needed at runtime)
├── reports/                    # Training reports (not needed at runtime)
├── requirements.txt
├── .env.example
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Root — application info |
| `GET` | `/health` | Health check (model, DB, version) |
| `POST` | `/predict` | Cardiac risk prediction |
| `POST` | `/sensor-data` | Store ESP32 sensor reading |
| `GET` | `/dashboard/{user_id}` | Aggregated dashboard |
| `GET` | `/history/{user_id}?period=week` | Historical readings |
| `POST` | `/emergency` | Trigger emergency alert |

### POST /predict

```json
{
  "age": 45,
  "gender": "Male",
  "height_cm": 175.0,
  "weight_kg": 80.0,
  "bmi": 26.1,
  "heart_rate": 72,
  "spo2": 98.0,
  "activity_level": "Moderately Active",
  "sleep_hours": 7.0,
  "stress_level": 40,
  "smoking": false,
  "diabetes": false,
  "hypertension": false,
  "heart_rate_variability": 55
}
```

Response:

```json
{
  "risk_level": "Low",
  "risk_score": 18.42,
  "confidence": 0.9968,
  "dcsi": 17.15
}
```

---

## DCSI — Daily Cardiac Stress Index

Formula:

```
DCSI = 0.35 × HR_Score + 0.25 × SpO₂_Score + 0.20 × HRV_Score + 0.20 × Activity_Score
```

Each sub-score maps the raw value to a 0–100 scale (higher = worse). The final DCSI is also 0–100:

| Range | Interpretation |
|---|---|
| 0–30 | Healthy |
| 31–60 | Moderate |
| 61–80 | High |
| 81–100 | Critical |

---

## ML Model

The default model is a **Logistic Regression** classifier trained on 25,000 synthetic patient records. It achieves ~88.7% F1-weighted accuracy. Model artifacts live in `app/ml/` and are loaded once at startup.

---

## PostgreSQL Tables

| Table | Purpose |
|---|---|
| `users` | Patient demographic profiles |
| `sensor_data` | Time-series vital-sign readings from ESP32 |
| `predictions` | ML prediction results |
| `emergency_contacts` | Emergency contact details |
| `alerts` | Emergency alert records |

---

## Testing

```bash
cd backend
pytest tests/ -v
```

---

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:admin123@localhost:5432/cardiac_risk_db` | PostgreSQL connection string |
| `CORS_ORIGINS` | `*` | Allowed origins |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
