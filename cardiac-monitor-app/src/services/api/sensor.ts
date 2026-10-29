import apiClient from './client';
import { API_ENDPOINTS, USE_MOCK_DATA } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import { mockSensorService } from '../mock/mockSensorService';
import type { SensorData } from '../../types';

function getUserId(): string {
  return useAppStore.getState().user?.id ?? 'user-001';
}

export async function getLatestSensorData(): Promise<SensorData> {
  // The BLE bridge (usePrediction) writes every live reading here.
  const live = useAppStore.getState().currentSensorData;
  if (live) return live;

  if (USE_MOCK_DATA) {
    return mockSensorService.getHistory(1)[0];
  }

  // No live BLE reading yet — try the backend, but don't hard-fail if it is
  // unreachable or has nothing persisted; the screen shows a waiting state.
  try {
    const response = await apiClient.get(API_ENDPOINTS.DASHBOARD(getUserId()));
    const d = response.data;
    return {
      heartRate: d.latest_heart_rate ?? 0,
      spo2: d.latest_spo2 ?? 0,
      hrv: 0,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return { heartRate: 0, spo2: 0, hrv: 0, timestamp: new Date().toISOString() };
  }
}

export async function getSensorHistory(params?: {
  limit?: number;
  period?: 'day' | 'week' | 'month';
}): Promise<SensorData[]> {
  const limit = params?.limit ?? 50;

  if (USE_MOCK_DATA) {
    return mockSensorService.getHistory(params?.limit ?? 20);
  }

  const period = params?.period ?? 'week';
  try {
    const response = await apiClient.get(API_ENDPOINTS.HISTORY(getUserId()), {
      params: { period },
    });
    const readings: Array<{
      heart_rate: number;
      spo2: number;
      heart_rate_variability?: number;
      timestamp?: string;
    }> = response.data.readings ?? [];
    if (readings.length > 0) {
      return readings.map((r) => ({
        heartRate: r.heart_rate,
        spo2: r.spo2,
        hrv: r.heart_rate_variability ?? 0,
        timestamp: r.timestamp ?? new Date().toISOString(),
      }));
    }
  } catch {
    // fall through to the in-session log
  }

  // Backend has nothing persisted yet (see docs/INTEGRATION.md gap #1) —
  // show the readings collected over BLE since the app launched.
  return useAppStore.getState().vitalsLog.slice(-limit);
}
