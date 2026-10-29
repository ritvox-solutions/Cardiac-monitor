import axios from 'axios';
import apiClient from '../api/client';
import { API_ENDPOINTS, HEALTH_PROFILE_LIMITS } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import type { BLESensorData, Prediction } from '../../types';

const SEND_INTERVAL_MS = 5000;

// MAX30102 does not expose HRV directly; used until firmware derives it from the PPG waveform.
const DEFAULT_HEART_RATE_VARIABILITY = 60;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Human-readable reason a /predict call failed, for the UI status banner. */
function describeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'backend not reachable. Check that the API is running and EXPO_PUBLIC_API_URL points to it.';
    }
    if (err.response.status === 422) {
      return 'the backend rejected the reading (422). Check your health profile values.';
    }
    if (err.response.status === 503) {
      return 'the ML model is not loaded on the server. Train it, then restart the API.';
    }
    return `backend returned HTTP ${err.response.status}.`;
  }
  return err instanceof Error ? err.message : 'unknown error.';
}

interface QueuedPayload {
  heart_rate: number;
  spo2: number;
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  activity_level: string;
  sleep_hours: number;
  stress_level: number;
  smoking: boolean;
  diabetes: boolean;
  hypertension: boolean;
  heart_rate_variability: number;
}

interface SensorPersistencePayload {
  user_id: string;
  heart_rate: number;
  spo2: number;
  heart_rate_variability: number;
  activity_level: string;
  sleep_hours: number;
  stress_level: number;
}

const PERSIST_RETRY_COUNT = 3;
const PERSIST_RETRY_DELAY_MS = 500;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class PredictionService {
  private intervalId: ReturnType<typeof setInterval> | null;
  private latestSensorData: BLESensorData | null;
  private onPrediction: (prediction: Prediction, dcsi: number) => void;
  private onError: (error: string) => void;
  private onPersistenceError: (error: string) => void;
  private queue: QueuedPayload[];
  private requestInFlight: boolean;

  constructor(
    onPrediction: (prediction: Prediction, dcsi: number) => void,
    onError: (error: string) => void,
    onPersistenceError: (error: string) => void = onError,
  ) {
    this.intervalId = null;
    this.latestSensorData = null;
    this.onPrediction = onPrediction;
    this.onError = onError;
    this.onPersistenceError = onPersistenceError;
    this.queue = [];
    this.requestInFlight = false;
  }

  updateSensorData(data: BLESensorData): void {
    this.latestSensorData = data;
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.sendToBackend();
    }, SEND_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async sendToBackend(): Promise<void> {
    if (!this.latestSensorData || this.requestInFlight) return;

    const payload = this.buildPayload(this.latestSensorData);
    if (!payload) {
      this.onError('Complete your health profile in Settings to get risk predictions');
      return;
    }

    this.requestInFlight = true;

    try {
      const response = await apiClient.post(API_ENDPOINTS.PREDICT, payload);
      const result = response.data as {
        risk_level: string;
        risk_score: number;
        confidence: number;
        dcsi: number;
      };

      const riskLevel = this.mapRiskLevel(result.risk_level);

      this.onPrediction(
        {
          riskLevel,
          riskScore: Math.round(result.risk_score),
          probability: result.confidence,
          timestamp: new Date().toISOString(),
        },
        result.dcsi,
      );

      await this.persistSensorReading(payload);
    } catch (err) {
      this.queue.push(payload);
      if (this.queue.length > 50) {
        this.queue.shift();
      }
      this.onError(`Risk prediction unavailable — ${describeError(err)}`);
    } finally {
      this.requestInFlight = false;
    }
  }

  private async persistSensorReading(payload: QueuedPayload): Promise<void> {
    const userId = useAppStore.getState().user?.id;
    if (!userId) {
      this.onPersistenceError('Reading was not saved: no authenticated user profile is available.');
      return;
    }

    const body: SensorPersistencePayload = {
      user_id: userId,
      // Preserve bradycardic transport readings for emergency/history data;
      // only the separate /predict payload is clamped to the model range.
      heart_rate: Math.round(
        Math.min(250, Math.max(20, this.latestSensorData?.heartRate ?? payload.heart_rate)),
      ),
      spo2: payload.spo2,
      heart_rate_variability: payload.heart_rate_variability,
      activity_level: payload.activity_level,
      sleep_hours: payload.sleep_hours,
      stress_level: payload.stress_level,
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= PERSIST_RETRY_COUNT; attempt += 1) {
      try {
        await apiClient.post(API_ENDPOINTS.SENSOR_DATA, body);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < PERSIST_RETRY_COUNT) await wait(PERSIST_RETRY_DELAY_MS * attempt);
      }
    }

    this.onPersistenceError(
      `Prediction available, but the sensor reading could not be saved after ${PERSIST_RETRY_COUNT} attempts — ${describeError(lastError)}`,
    );
  }

  async flushQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const payload = this.queue[0];
      try {
        await apiClient.post(API_ENDPOINTS.PREDICT, payload);
        this.queue.shift();
      } catch {
        break;
      }
    }
  }

  private buildPayload(data: BLESensorData): QueuedPayload | null {
    const profile = useAppStore.getState().user?.healthProfile;
    if (!profile) return null;

    // Coerce the live BLE values into the ranges the backend's PredictionInput
    // schema accepts (app/schemas/prediction.py), so a borderline reading gives
    // a prediction instead of an opaque 422.
    return {
      heart_rate: Math.round(clamp(data.heartRate, 40, 190)),
      spo2: Number(clamp(data.spo2, 75, 100).toFixed(1)),
      age: profile.age,
      gender: profile.gender,
      height_cm: profile.heightCm,
      weight_kg: profile.weightKg,
      bmi: profile.bmi,
      activity_level: profile.activityLevel,
      sleep_hours: profile.sleepHours,
      stress_level: profile.stressLevel,
      smoking: profile.smoking,
      diabetes: profile.diabetes,
      hypertension: profile.hypertension,
      heart_rate_variability: clamp(
        DEFAULT_HEART_RATE_VARIABILITY,
        HEALTH_PROFILE_LIMITS.HEART_RATE_VARIABILITY.MIN,
        HEALTH_PROFILE_LIMITS.HEART_RATE_VARIABILITY.MAX,
      ),
    };
  }

  private mapRiskLevel(level: string): Prediction['riskLevel'] {
    const l = level.toLowerCase();
    if (l === 'low') return 'healthy';
    if (l === 'medium') return 'moderate';
    if (l === 'high') return 'high';
    if (l === 'critical') return 'critical';
    return 'healthy';
  }
}
