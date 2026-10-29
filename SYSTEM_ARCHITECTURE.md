# SYSTEM_ARCHITECTURE.md

# Wearable Cardiac Risk Monitoring and Emergency Alert System

Version: 1.0

Author: RitVox Solutions

Status: Architecture Approved (partially superseded)

---

> ⚠️ **Partially superseded.** This document captures the original design. The
> implementation has since diverged in several places:
> - **Database is PostgreSQL**, not MongoDB (SQLAlchemy 2.0 async + asyncpg).
> - **ESP32 is BLE-only** — it does not use WiFi or talk to the backend directly;
>   the mobile app forwards readings over HTTPS.
> - **GPS is not in the wearable firmware** — location for `/emergency` comes
>   from the phone.
> - API request/response shapes and endpoint paths differ from Sections 6–8.
>
> For the current end-to-end contract and the list of remaining wiring gaps, see
> [`docs/INTEGRATION.md`](docs/INTEGRATION.md) and
> [`backend/README.md`](backend/README.md).

---

# 1. Project Objective

Develop a wearable IoT-based cardiac monitoring system capable of

- Monitoring Heart Rate
- Monitoring Blood Oxygen (SpO₂)
- Estimating Cardiac Risk using Machine Learning
- Calculating Daily Cardiac Stress Index (DCSI)
- Tracking GPS Location
- Sending Emergency Alerts
- Displaying Live Health Data in a React Native App

> **Disclaimer:** This project is intended for educational and research purposes only. It estimates cardiac risk and does not diagnose heart disease or replace professional medical advice.

---

# 2. System Overview

                    +--------------------+
                    | React Native App   |
                    +---------+----------+
                              ▲
                              │ REST API
                              │
+-------------+  BLE  +---------+----------+      +----------------+
| ESP32       | ~~~>  | Mobile app (RN)    |      |                |
| MAX30102    |       +---------+----------+      |                |
+-------------+                 | HTTPS           |                |
                      +---------v----------+      +-------+--------+
                      | FastAPI Backend    | ---> | PostgreSQL      |
                      | ML Prediction      |      +----------------+
                      | DCSI Calculation   |
                      | Alert Engine       |
                      +--------------------+

---

# 3. Data Flow

Sensor

↓

ESP32

↓

WiFi

↓

REST API

↓

FastAPI

↓

Machine Learning

↓

DCSI Calculation

↓

Database

↓

React Native App

↓

Emergency Alert

---

# 4. Component Responsibilities

## Hardware

ESP32

Responsibilities

- Read MAX30102
- Read GPS
- Connect to WiFi
- Send sensor data every 5 seconds
- Retry failed requests
- Buffer readings if offline

---

MAX30102

Collect

- Heart Rate
- Blood Oxygen (SpO₂)

---

GPS

Collect

- Latitude
- Longitude
- Timestamp

---

## Backend

Framework

FastAPI

Responsibilities

- Receive sensor data
- Validate payload
- Store data
- Run ML prediction
- Calculate DCSI
- Detect emergency conditions
- Return response to mobile app

---

## Machine Learning

Training Data

Synthetic Dataset

Models

- Logistic Regression
- Decision Tree
- Random Forest

Output

Low Risk

Medium Risk

High Risk

Risk Score (0–100)

---

## Database

PostgreSQL (SQLAlchemy 2.0 async + asyncpg)

Tables

users

sensor_data

predictions

emergency_contacts

alerts

---

## Mobile App

Framework

React Native (TypeScript)

Responsibilities

- Authentication (basic/local)
- Dashboard
- Live Heart Rate
- Live SpO₂
- DCSI Visualization
- Risk History
- Emergency Contacts
- Maps
- Notifications
- Settings

---

# 5. Folder Structure

wearable-cardiac-system/

backend/

    api/

    models/

    database/

    services/

    ml/

    utils/

mobile/

    src/

        components/

        screens/

        services/

        hooks/

        context/

        navigation/

hardware/

    esp32/

    gps/

    sensors/

dataset/

docs/

assets/

---

# 6. API Endpoints

POST /sensor-data

Purpose

Receive live sensor readings

---

POST /predict

Purpose

Predict cardiac risk

---

GET /history

Purpose

Retrieve historical sensor data

---

GET /dashboard

Purpose

Return dashboard summary

---

POST /emergency

Purpose

Trigger emergency workflow

---

GET /health

Purpose

Backend health check

---

# 7. Request Format

POST /sensor-data

```json
{
  "device_id": "ESP32-001",
  "heart_rate": 82,
  "spo2": 98,
  "latitude": 12.914,
  "longitude": 74.856,
  "timestamp": "2026-08-01T12:00:00Z"
}
```

---

# 8. Response Format

```json
{
  "risk": "Low",
  "risk_score": 18,
  "dcsi": 24,
  "alert": false
}
```

---

# 9. Database Schema

Users

- user_id
- name
- age
- gender
- weight
- height
- bmi
- emergency_contact
- created_at

---

Sensor Data

- user_id
- heart_rate
- spo2
- latitude
- longitude
- timestamp

---

Predictions

- user_id
- risk_score
- risk_level
- dcsi
- timestamp

---

Emergency Contacts

- name
- phone
- relationship

---

# 10. Machine Learning Pipeline

Synthetic Dataset

↓

Cleaning

↓

Feature Engineering

↓

Train/Test Split

↓

Train Models

↓

Evaluate

↓

Export model.pkl

↓

FastAPI Loads Model

↓

Prediction

---

# 11. Synthetic Dataset

Features

- Age
- Gender
- Height
- Weight
- BMI
- Heart Rate
- SpO₂
- Activity Level
- Stress Level
- Sleep Hours
- Smoking
- Diabetes
- Hypertension
- HRV
- Risk Label

Dataset Size

20,000–50,000 Records

---

# 12. Daily Cardiac Stress Index (DCSI)

Formula

DCSI =

0.35 × Heart Rate Score

+

0.25 × SpO₂ Score

+

0.20 × HRV Score

+

0.20 × Activity Score

Normalize

0–100

Risk Levels

0–30 Healthy

31–60 Moderate

61–80 High

81–100 Critical

---

# 13. Emergency Conditions

Trigger if

Heart Rate > 150 BPM

OR

Heart Rate < 40 BPM

OR

SpO₂ < 90%

OR

Risk Score > 80

Actions

- Save event
- Send location
- Display warning in app
- Notify emergency contact (simulated or integrated)

---

# 14. UI Screens

- Splash
- Login
- Dashboard
- Live Monitoring
- Risk Meter
- DCSI Screen
- History
- Emergency Contacts
- Maps
- Settings

---

# 15. Development Timeline

Day 1

Architecture

Dataset

Machine Learning

---

Day 2

Backend

Database

---

Day 3

React Native

---

Day 4

ESP32

MAX30102

GPS

---

Day 5

Integration

---

Day 6

Emergency System

Testing

---

Day 7

Documentation

Presentation

Demo

---

# 16. Coding Standards

Python

- PEP8
- Type Hints
- Black
- Docstrings

React Native

- TypeScript
- Functional Components
- Hooks
- Reusable Components

Backend

- Modular
- Async
- Validation
- Error Handling
- Logging

---

# 17. Non-Functional Requirements

- Response time < 2 seconds
- API validation on all requests
- Clean architecture
- Modular codebase
- Maintainable folder structure
- Production-style coding practices

---

# 18. Future Enhancements

- ECG sensor integration
- TinyML inference on ESP32
- Wear OS support
- Apple Watch support
- Push notifications
- Doctor dashboard
- Cloud deployment
- Real-time anomaly detection
- AI trend analysis
- Multi-user support

---

# 19. Definition of Done

✔ ESP32 sends live data

✔ Backend receives data

✔ ML predicts risk

✔ DCSI calculated

✔ PostgreSQL stores readings

✔ React Native displays live information

✔ Emergency workflow functions

✔ End-to-end system tested

✔ Documentation complete

✔ Demo ready