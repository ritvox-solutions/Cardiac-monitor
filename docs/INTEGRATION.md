# INTEGRATION.md — End-to-End Data Pipeline

> **Source of truth** for how the modules actually talk to each other today.
> Where this document and `SYSTEM_ARCHITECTURE.md` disagree, this document wins
> (the architecture doc predates the PostgreSQL migration and several API
> changes). Last reconciled: 2026-08-31.

---

## 1. The real pipeline

```
MAX30102 --I2C--> ESP32 --BLE notify--> Mobile app --HTTPS--> FastAPI --> ML model
                (0000ffe1..)          (cardiac-monitor-app)    |         (LogisticRegression)
                                                               |--> PostgreSQL (SQLAlchemy async)
                                                               '--> response --> Mobile app UI
```

Key facts that differ from the older architecture doc:

| Topic | `SYSTEM_ARCHITECTURE.md` says | Reality |
|---|---|---|
| Database | MongoDB (collections) | **PostgreSQL** — SQLAlchemy 2.0 async + asyncpg, tables in `app/models/postgres_models.py` |
| ESP32 -> backend | ESP32 posts over WiFi | ESP32 is **BLE-only**; the phone does all networking |
| ESP32 -> GPS | ESP32 reads NEO-6M | GPS is **not** in the BLE firmware; location comes from the phone for `/emergency` |
| `/sensor-data` body | `device_id`, ISO timestamp | `user_id` (string), plus `heart_rate`, `spo2`, `heart_rate_variability` |
| Risk levels from ML | Low / Medium / High | Model classes are `['High', 'Low', 'Medium']` — **"Critical" is never returned by `/predict`**; it only exists as a DCSI band |
| ML models compared | LogReg, DecisionTree, RandomForest | Also GradientBoosting + XGBoost (see `trained_models/metrics.json`) |

---

## 2. Contracts (must stay in sync)

### 2.1 BLE — ESP32 <-> Mobile app

| | Value | Enforced by |
|---|---|---|
| Device name prefix | `ESP32-CardiacMonitor` (app filters `ESP32*`) | `esp32_ble_firmware.ino` <-> `BLEScanner.ts` |
| Service UUID | `0000ffe0-0000-1000-8000-00805f9b34fb` | `BLEConnection.ts: SENSOR_SERVICE_UUID` |
| Characteristic UUID | `0000ffe1-0000-1000-8000-00805f9b34fb` | `BLEConnection.ts: SENSOR_CHARACTERISTIC_UUID` |
| Payload fields | `heart_rate, spo2, temperature, battery, timestamp` | `BLEParser.ts: REQUIRED_FIELDS_SNAKE` |

BLE notification payload (one JSON line every ~2 s):

```json
{ "heart_rate": 72, "spo2": 98.0, "temperature": 33.1, "battery": 80, "timestamp": 123456 }
```

`temperature` and `battery` are consumed by the app for display only; the backend
never sees them. `timestamp` is `millis()` since boot, not wall-clock.

### 2.2 HTTP — Mobile app <-> FastAPI

Base URL from `cardiac-monitor-app/.env` (`EXPO_PUBLIC_API_URL`). Endpoints in
`src/constants/index.ts: API_ENDPOINTS`.

| Endpoint | Called from | Status |
|---|---|---|
| `POST /predict` | `src/services/bluetooth/PredictionService.ts` (every 5 s) | wired — result → `currentPrediction`/`currentDcsi`; failures → `predictionStatus`/`predictionError` in the store, shown on Live Monitoring |
| `GET /dashboard/{user_id}` | `src/services/api/sensor.ts: getLatestSensorData` | wired (returns empty until data is persisted — see gap #2) |
| `GET /history/{user_id}?period=week` | `src/services/api/sensor.ts: getSensorHistory` | wired (same caveat) |
| `POST /emergency` | `src/services/api/emergency.ts` | wired |
| `POST /sensor-data` | **nothing** — constant defined, never used | GAP #1 |
| user / profile registration | **no endpoint exists** | GAP #3 |

`POST /predict` request (all fields required — `PredictionInput`):

```json
{
  "age": 45, "gender": "Male", "height_cm": 175.0, "weight_kg": 80.0, "bmi": 26.1,
  "heart_rate": 72, "spo2": 98.0, "activity_level": "Moderately Active",
  "sleep_hours": 7.0, "stress_level": 40,
  "smoking": false, "diabetes": false, "hypertension": false,
  "heart_rate_variability": 55
}
```

Response (`PredictionOutput`):

```json
{ "risk_level": "Low", "risk_score": 18.42, "confidence": 0.9968, "dcsi": 17.15 }
```

The app maps `risk_level` (`Low|Medium|High`) -> UI enum (`healthy|moderate|high|critical`)
in `PredictionService.mapRiskLevel`. `confidence` is surfaced as `probability`.

`PredictionService.buildPayload` rounds `heart_rate` and clamps `heart_rate`,
`spo2`, and `heart_rate_variability` into the `PredictionInput` bounds before
sending, so a borderline live reading yields a prediction rather than a 422.
`usePrediction` (in `MainTabs`) owns the loop lifecycle and writes
`predictionStatus` (`idle|pending|ok|error`) + `predictionError` to the store;
a `503` means the model is not loaded server-side, a network error means the
API is unreachable / `EXPO_PUBLIC_API_URL` is wrong.

`POST /sensor-data` request (`SensorDataInput`) — persists a reading **and**
returns a prediction *iff* a matching user profile exists in `users`:

```json
{ "user_id": "USER_00001", "heart_rate": 82, "spo2": 98.0, "heart_rate_variability": 55,
  "activity_level": null, "sleep_hours": null, "stress_level": null,
  "latitude": null, "longitude": null, "timestamp": null }
```

### 2.3 FastAPI <-> ML

`PredictionService` (singleton) loads `app/ml/{cardiac_model.pkl, label_encoder.pkl}`
at startup. `_to_dataframe` builds a 16-column row in `_FEATURE_ORDER`. GPS
columns are filled with constants (`28.61, 77.23`) because the training feature
set includes them but the model does not use them meaningfully.

### 2.4 FastAPI <-> PostgreSQL

`DATABASE_URL` in `backend/.env`. Tables auto-created on startup via
`Base.metadata.create_all` (no Alembic). Tables: `users`, `sensor_data`,
`predictions`, `emergency_contacts`, `alerts`. If Postgres is unreachable the API
starts in **degraded mode** — `/predict` and `/health` still work; persistence
endpoints return HTTP 500.

---

## 3. Wiring gaps (punch-list for "complete data pipeline")

### Gap #1 — Sensor readings are not persisted server-side
`PredictionService.sendToBackend()` posts to `/predict`, which is stateless.
`/sensor-data` (which writes to `sensor_data`) is still never called, so
`/dashboard` and `/history` return empty from the backend.

**Client-side workaround (done):** the app now runs on real data with
`USE_MOCK_DATA = false`. `usePrediction` mirrors every BLE reading into the
store (`currentSensorData` + a session `vitalsLog`), and the API layer serves
Dashboard/History/Prediction from that store first, backend second. So the live
screens work off the wearable without server persistence. History is
**session-only** (lost on app restart) until the server side lands.

**Still to do (server-side):** in `PredictionService`, also POST to
`/sensor-data` (needs `user_id` — see gap #3) so history survives restarts and
is shared across devices.

### Gap #2 — Backend `/dashboard` + `/history` stay empty
Unblocked once gap #1's server-side half lands. The app no longer depends on
them for the live view.

### Gap #3 — No user/profile endpoint
`users` table + `UserORM` exist, but there is no `POST /users` / `PUT /users/{id}`.
The mobile HealthProfileForm stores the profile only in the local Zustand store
(`useAppStore`). Therefore `/sensor-data` can never look up a profile and its
prediction branch is dead.

**Fix:** add `app/api/routes/users.py` (`POST /users`, `GET /users/{user_id}`,
`PUT /users/{user_id}`) + `UserService`, and have the app sync the profile on
save / login.

### Gap #4 — `/predict` cannot return "Critical"
ML has 3 classes. DCSI has 4 bands. The app's `critical` state is only reachable
via DCSI, not via `risk_level`. Decide: either (a) treat DCSI as the source of the
UI risk state, or (b) add a "Critical" class to the training labels. Document the
choice here once made.

### Gap #5 — HRV is a constant
ESP32 does not compute HRV; `PredictionService` hard-codes
`DEFAULT_HEART_RATE_VARIABILITY = 60`. Every prediction and DCSI uses this
placeholder. Options: derive SDNN/RMSSD from inter-beat intervals on the ESP32
and add an `hrv` field to the BLE payload, or compute it app-side from beat
timestamps.

### Gap #6 — Emergency auto-trigger is client-only
`POST /sensor-data` / `POST /predict` do not evaluate the emergency thresholds
(HR > 150 or < 40, SpO2 < 90, risk_score > 80). The app must notice and call
`/emergency` itself. Consider evaluating thresholds server-side in
`/sensor-data` and returning an `emergency: true` flag.

### Gap #7 — BLE MTU not negotiated — **FIXED**
The firmware's JSON notification is ~80 bytes; the default ATT MTU of 23 (20
usable) truncated it on Android. `BLEConnection.connect()` now calls
`connected.requestMTU(185)` (try/catch; iOS ignores it) right after connecting,
and the firmware calls `BLEDevice::setMTU(185)`.

---

## 4. Recommended build order

The app now runs on real hardware data (`USE_MOCK_DATA = false`). Remaining:

1. **Gap #3** — users endpoint + profile sync (so `/sensor-data` can attach a
   real `user_id`).
2. **Gap #1 (server half)** — `PredictionService` also POSTs `/sensor-data` so
   history survives app restarts.
3. **Gap #6** — server-side threshold check -> `emergency` flag in the response.
4. **Gap #4 / #5** — HRV + Critical class (model retrain, coordinate with `ml/`).

---

## 5. Running the pipeline

### Real data (default — `USE_MOCK_DATA = false`)

```bash
# 1. Backend — must be reachable at EXPO_PUBLIC_API_URL (cardiac-monitor-app/.env)
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2. Mobile — needs a dev build (BLE is not available in Expo Go)
cd cardiac-monitor-app && npm install
npx expo run:android      # or run:ios / an EAS dev build
```

Then in the app: **Settings → Health Profile** (required — `/predict` needs it),
then **Live Monitoring → Connect to Watch**. The ESP32 must be powered with a
finger on the sensor. Once connected:

- Live Monitoring shows HR / SpO2 / temp / battery straight from BLE.
- Every reading is mirrored into the store, so Dashboard and History (this
  session) and the `/predict`-derived risk + DCSI all update.
- HRV is `0` (the wearable doesn't measure it — gap #5).
- History is session-only until gap #1's server half lands.

### UI only, no hardware or server (`USE_MOCK_DATA = true`)

Flip the flag in `src/constants/index.ts`. `mockSensorService` then generates
synthetic vitals/prediction/DCSI and no BLE or backend is needed.
