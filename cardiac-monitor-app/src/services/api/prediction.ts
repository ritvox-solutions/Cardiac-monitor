import apiClient from './client';
import { API_ENDPOINTS, USE_MOCK_DATA } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import { mockApi } from '../mock';
import { mockSensorService } from '../mock/mockSensorService';
import type { Prediction, Dcsi } from '../../types';

function getUserId(): string {
  return useAppStore.getState().user?.id ?? 'user-001';
}

export async function getLatestPrediction(): Promise<Prediction> {
  // Populated by the BLE bridge from each /predict response.
  const cached = useAppStore.getState().currentPrediction;
  if (cached) return cached;

  const empty: Prediction = {
    riskLevel: 'healthy',
    riskScore: 0,
    probability: 0,
    timestamp: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    return { ...empty, riskScore: 20, probability: 0.95 };
  }

  // No live reading yet and nothing persisted server-side — return a neutral
  // placeholder rather than throwing, so the screen shows a waiting state.
  try {
    const response = await apiClient.get(API_ENDPOINTS.DASHBOARD(getUserId()), {
      timeout: 6000,
    });
    const d = response.data;
    return {
      riskLevel: mapRisk(d.current_risk_level),
      riskScore: Math.round(d.current_risk_score ?? 0),
      probability: d.latest_prediction?.confidence ?? 0,
      timestamp: d.latest_prediction?.timestamp ?? new Date().toISOString(),
    };
  } catch {
    return empty;
  }
}

export async function getPredictionHistory(params?: { limit?: number }): Promise<Prediction[]> {
  try {
    // Short timeout: history is non-critical, so fall back to local data fast
    // rather than blocking the screen on the global 15s timeout.
    const response = await apiClient.get(API_ENDPOINTS.HISTORY(getUserId()), {
      params: { period: 'month' },
      timeout: 6000,
    });
    const readings = response.data.readings ?? [];
    if (readings.length === 0) throw new Error('empty');
    return readings.map((r: { risk_level?: string; risk_score?: number; timestamp?: string }) => ({
      riskLevel: mapRisk(r.risk_level),
      riskScore: Math.round(r.risk_score ?? 0),
      probability: 0,
      timestamp: r.timestamp ?? new Date().toISOString(),
    }));
  } catch {
    return mockApi.prediction.history(params);
  }
}

function mapRisk(level?: string): Prediction['riskLevel'] {
  if (!level) return 'healthy';
  const l = level.toLowerCase();
  if (l === 'low') return 'healthy';
  if (l === 'medium') return 'moderate';
  if (l === 'high') return 'high';
  if (l === 'critical') return 'critical';
  return 'healthy';
}

export async function requestPrediction(customVitals?: {
  heartRate?: number;
  spo2?: number;
  hrv?: number;
}): Promise<{ prediction: Prediction; dcsi: Dcsi }> {
  const state = useAppStore.getState();
  const profile = state.user?.healthProfile;
  const liveSensor = state.currentSensorData;

  const hr = customVitals?.heartRate ?? (liveSensor && liveSensor.heartRate > 0 ? liveSensor.heartRate : 72);
  const spo2 = customVitals?.spo2 ?? (liveSensor && liveSensor.spo2 > 0 ? liveSensor.spo2 : 98.0);
  const hrv = customVitals?.hrv ?? (liveSensor && liveSensor.hrv > 0 ? liveSensor.hrv : 55);

  const payload = {
    age: profile?.age ?? 45,
    gender: profile?.gender ?? 'Male',
    height_cm: profile?.heightCm ?? 175.0,
    weight_kg: profile?.weightKg ?? 80.0,
    bmi: profile?.bmi ?? 26.1,
    heart_rate: Math.round(hr),
    spo2: Number(spo2.toFixed(1)),
    activity_level: profile?.activityLevel ?? 'Moderately Active',
    sleep_hours: profile?.sleepHours ?? 7.0,
    stress_level: profile?.stressLevel ?? 40,
    smoking: profile?.smoking ?? false,
    diabetes: profile?.diabetes ?? false,
    hypertension: profile?.hypertension ?? false,
    heart_rate_variability: Math.round(hrv),
  };

  const response = await apiClient.post(API_ENDPOINTS.PREDICT, payload);
  const data = response.data as {
    risk_level: string;
    risk_score: number;
    confidence: number;
    dcsi: number;
  };

  const prediction: Prediction = {
    riskLevel: mapRisk(data.risk_level),
    riskScore: Math.round(data.risk_score),
    probability: data.confidence,
    timestamp: new Date().toISOString(),
  };

  const dcsiScore = Math.round(data.dcsi);
  const dcsi: Dcsi = {
    score: dcsiScore,
    heartRateScore: Math.min(100, Math.round((payload.heart_rate / 100) * 25)),
    spo2Score: Math.min(100, Math.round((payload.spo2 / 100) * 25)),
    hrvScore: Math.min(100, Math.round((payload.heart_rate_variability / 100) * 20)),
    activityScore: 20,
    riskLevel: dcsiScore <= 30 ? 'healthy' : dcsiScore <= 60 ? 'moderate' : dcsiScore <= 80 ? 'high' : 'critical',
    date: new Date().toISOString().split('T')[0],
  };

  // Update store immediately
  state.setCurrentPrediction(prediction);
  state.setCurrentDcsi(dcsi);
  if (!state.currentSensorData) {
    state.setCurrentSensorData({
      heartRate: payload.heart_rate,
      spo2: payload.spo2,
      hrv: payload.heart_rate_variability,
      timestamp: new Date().toISOString(),
    });
  }
  state.setPredictionStatus('ok');

  return { prediction, dcsi };
}

