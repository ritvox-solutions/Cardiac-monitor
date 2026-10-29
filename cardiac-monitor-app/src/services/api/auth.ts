import apiClient from './client';
import { API_ENDPOINTS } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import { mockApi } from '../mock';
import type { User, AuthResponse, HealthProfile } from '../../types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return mockApi.auth.login(data);
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return mockApi.auth.register(data);
}

export async function getProfile(): Promise<User> {
  const userId = useAppStore.getState().user?.id || 'USER_00001';
  try {
    const res = await apiClient.get(API_ENDPOINTS.USER_PROFILE(userId));
    if (res.data) {
      const d = res.data;
      const currentUser = useAppStore.getState().user;
      return {
        id: d.user_id,
        name: currentUser?.name || 'Patient',
        email: currentUser?.email || 'patient@example.com',
        emergencyContacts: currentUser?.emergencyContacts || [],
        createdAt: currentUser?.createdAt || new Date().toISOString(),
        healthProfile: {
          age: d.age,
          gender: d.gender,
          heightCm: d.height_cm,
          weightKg: d.weight_kg,
          bmi: d.bmi,
          activityLevel: currentUser?.healthProfile?.activityLevel || 'Moderately Active',
          sleepHours: currentUser?.healthProfile?.sleepHours || 7,
          stressLevel: currentUser?.healthProfile?.stressLevel || 40,
          smoking: d.smoking,
          diabetes: d.diabetes,
          hypertension: d.hypertension,
        },
      };
    }
  } catch {
    // fallback to mock
  }
  return mockApi.auth.profile();
}

export async function updateHealthProfile(profile: HealthProfile): Promise<User> {
  const userId = useAppStore.getState().user?.id || 'USER_00001';
  const response = await apiClient.post(API_ENDPOINTS.USERS, {
    user_id: userId,
    age: profile.age,
    gender: profile.gender,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    bmi: profile.bmi,
    smoking: profile.smoking,
    diabetes: profile.diabetes,
    hypertension: profile.hypertension,
  });

  const currentUser = useAppStore.getState().user;
  return {
    id: response.data.user_id,
    name: currentUser?.name || 'Patient',
    email: currentUser?.email || 'patient@example.com',
    emergencyContacts: currentUser?.emergencyContacts || [],
    createdAt: response.data.created_at || currentUser?.createdAt || new Date().toISOString(),
    healthProfile: profile,
  };
}
