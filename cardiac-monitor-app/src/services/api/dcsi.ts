import apiClient from './client';
import { API_ENDPOINTS, USE_MOCK_DATA } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import { mockApi } from '../mock';
import type { Dcsi } from '../../types';

function getUserId(): string {
  return useAppStore.getState().user?.id ?? 'user-001';
}

export async function getCurrentDcsi(): Promise<Dcsi> {
  // Populated by the BLE bridge from each /predict response.
  const cached = useAppStore.getState().currentDcsi;
  if (cached) return cached;

  const today = new Date().toISOString().split('T')[0];

  if (USE_MOCK_DATA) {
    return {
      score: 45,
      heartRateScore: 80,
      spo2Score: 95,
      hrvScore: 70,
      activityScore: 60,
      riskLevel: 'moderate',
      date: today,
    };
  }

  const toRisk = (s: number): Dcsi['riskLevel'] =>
    s <= 30 ? 'healthy' : s <= 60 ? 'moderate' : s <= 80 ? 'high' : 'critical';

  try {
    const response = await apiClient.get(API_ENDPOINTS.DASHBOARD(getUserId()));
    const score = Math.round(response.data.current_dcsi ?? 0);
    return {
      score,
      heartRateScore: 0,
      spo2Score: 0,
      hrvScore: 0,
      activityScore: 0,
      riskLevel: toRisk(score),
      date: today,
    };
  } catch {
    return {
      score: 0,
      heartRateScore: 0,
      spo2Score: 0,
      hrvScore: 0,
      activityScore: 0,
      riskLevel: 'healthy',
      date: today,
    };
  }
}

export async function getDcsiHistory(params?: { limit?: number }): Promise<Dcsi[]> {
  try {
    return await mockApi.dcsi.history(params);
  } catch {
    return [];
  }
}
