# PROJECT_ROADMAP.md

# Wearable Cardiac Risk Monitoring and Emergency Alert System

Duration

7 Days

---

# Day 1

## Architecture

- Finalize system architecture
- Folder structure
- Database schema
- API contracts

## Machine Learning

- Design synthetic dataset
- Generate 20,000+ records
- Train ML models
- Compare models
- Export best model

Deliverables

✅ Dataset

✅ model.pkl

✅ Architecture Diagram

---

# Day 2

Backend

Create FastAPI project.

Implement

POST /predict

POST /sensor-data

GET /history

GET /dashboard

Connect PostgreSQL.

Deliverables

Backend running.

Swagger working.

Database connected.

---

# Day 3

React Native

Create application.

Implement

Splash

Login

Dashboard

History

Prediction

Emergency Contacts

Settings

Deliverables

App UI completed.

---

# Day 4

Hardware

Connect

ESP32

MAX30102

GPS

Read sensor values.

Transmit JSON.

Deliverables

Hardware communicating with backend.

---

# Day 5

Integration

ESP32

↓

Backend

↓

ML

↓

Database

↓

React Native

Implement DCSI.

Display live data.

Deliverables

Complete data pipeline.

---

# Day 6

Emergency System

Trigger emergency when

Heart Rate exceeds threshold

SpO₂ below threshold

High ML Risk

Features

GPS

Alert

Emergency Contact

Deliverables

Emergency workflow complete.

---

# Day 7

Final Polish

Bug Fixes

UI Improvements

Testing

Documentation

Presentation

Demo Video

Deliverables

Final Working Project

---

# Project Modules

Status as of 2026-08-31. See `docs/INTEGRATION.md` for the gap punch-list.

| # | Module | Status | Notes |
|---|---|---|---|
| 1 | Synthetic Dataset | ✅ Done | `dataset/generate_dataset.py`, 25,000 records |
| 2 | Machine Learning | ✅ Done | 5 models compared; LogisticRegression deployed (F1 0.887). XGBoost scored best (F1 0.906) but is not the deployed model — see `trained_models/metrics.json` |
| 3 | Backend | ✅ Done | FastAPI, 6 endpoint groups, Swagger, 10/10 smoke tests passing |
| 4 | Database | 🟡 In progress | PostgreSQL wired (SQLAlchemy async). Gaps: no `/users` endpoint, sensor readings not persisted from the app (gaps #1, #3) |
| 5 | React Native | 🟡 In progress | All screens built. **Runs on real data** (`USE_MOCK_DATA = false`): BLE→store bridge feeds live vitals + `/predict` risk/DCSI to all screens. Session-only history (gap #1 server half pending); auth still local-mock |
| 6 | ESP32 Firmware | 🟡 Code complete | BLE peripheral firmware for **Seeed XIAO ESP32-C6** (arduino-esp32 core 3.x) — MAX30102 + Maxim SpO2 algorithm; not yet flashed/tested on hardware |
| 7 | Sensor Integration | 🟡 In progress | Full BLE path live: scan→connect→MTU→notify→parse→store→`/predict`. Server-side persistence (`/sensor-data`) still missing (gap #1) |
| 8 | GPS Integration | 🔴 Pending | Not in BLE firmware by design; phone supplies location to `/emergency`. NEO-6M path not built |
| 9 | Emergency Alert | 🟡 In progress | `/emergency` endpoint + app call wired; no server-side auto-trigger on thresholds (gap #6) |
| 10 | Documentation | 🟡 In progress | Architecture + integration docs; roadmap refreshed. Presentation / demo video pending |

---

# Success Criteria

✓ Live sensor monitoring

✓ ML-based cardiac risk estimation

✓ DCSI calculation

✓ GPS tracking

✓ Emergency alert system

✓ React Native mobile application

✓ FastAPI backend

✓ PostgreSQL database

✓ Professional documentation

✓ Working demonstration

---

# Future Enhancements

- ECG sensor integration
- TinyML on ESP32
- Push notifications
- Doctor dashboard
- Cloud deployment
- Wear OS support
- Apple Watch support
- AI trend analysis
- Real-time anomaly detection
- Multi-user support