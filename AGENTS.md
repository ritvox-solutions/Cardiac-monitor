# AGENTS.md

# Project Name
Wearable Cardiac Risk Monitoring and Emergency Alert System

## Project Overview

This project aims to develop a wearable IoT-based healthcare system capable of continuously monitoring a user's heart rate and blood oxygen (SpO₂), estimating cardiac risk using machine learning, calculating a Daily Cardiac Stress Index (DCSI), and sending emergency alerts with GPS location during critical situations.

**This is NOT a medical diagnostic device.**

The project is intended for academic and research purposes only.

---

# Tech Stack

## Hardware

- Seeed Studio XIAO ESP32-C6 (arduino-esp32 core 3.x required)
- MAX30102 Heart Rate + SpO₂ Sensor (I²C: SDA=D4/GPIO22, SCL=D5/GPIO23)
- NEO-6M GPS Module (not yet integrated — phone supplies location)
- Li-ion Battery
- TP4056 Charging Module

---

## Backend

- Python 3.12+
- FastAPI
- Uvicorn
- Pydantic
- Scikit-Learn
- Pandas
- NumPy
- Joblib

---

## Database

PostgreSQL (migrated from MongoDB — SQLAlchemy 2.0 async + asyncpg)

Tables

- users
- sensor_data
- predictions
- emergency_contacts
- alerts

Access via the `get_db_session` dependency. Schema defined in
`backend/app/models/postgres_models.py`. See `docs/INTEGRATION.md`.

---

## Mobile App

React Native

Libraries

- React Navigation
- Axios
- React Native Paper
- React Native Maps
- React Native Chart Kit
- AsyncStorage

---

# Project Architecture

ESP32

↓

REST API

↓

FastAPI Backend

↓

Machine Learning

↓

PostgreSQL

↓

React Native App

---

# Machine Learning

Training Dataset

Synthetic Dataset

Algorithms

- Logistic Regression
- Decision Tree
- Random Forest

Compare all models.

Deploy the best-performing model.

---

# Daily Cardiac Stress Index (DCSI)

DCSI =

35% Heart Rate Score

25% SpO₂ Score

20% HRV Score

20% Activity Score

Normalize score between

0–100

Risk Levels

0–30 Healthy

31–60 Moderate

61–80 High

81–100 Critical

---

# Coding Standards

Python

- PEP8
- Type Hints
- Docstrings
- Black Formatting

React Native

- TypeScript Only
- Functional Components
- Hooks
- Clean Architecture

Backend

- Modular Structure
- Dependency Injection
- Repository Pattern where applicable

---

# Folder Structure

wearable-cardiac-system/

backend/

mobile/

hardware/

ml/

dataset/

docs/

assets/

---

# Rules

DO NOT hardcode values.

Always use environment variables.

Every API must have validation.

Every function must contain documentation.

Every endpoint must return proper HTTP status codes.

Every commit should compile successfully.

---

# Git Branches

main

develop

feature/backend

feature/mobile

feature/hardware

feature/ml

---

# Deliverables

Working ESP32 firmware

Synthetic Dataset

ML Model

Backend APIs

React Native App

PostgreSQL Integration

Emergency Alert System

Documentation

Presentation

Demo Video

---

# Development Philosophy

Build one module at a time.

Never move to the next module until the current module is tested.

Keep the code production-quality even though this is an academic project.