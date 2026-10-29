export type ActivityLevel = 'Sedentary' | 'Lightly Active' | 'Moderately Active' | 'Very Active';
export type Gender = 'Male' | 'Female';

export interface HealthProfile {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  bmi: number;
  activityLevel: ActivityLevel;
  sleepHours: number;
  stressLevel: number;
  smoking: boolean;
  diabetes: boolean;
  hypertension: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  emergencyContacts: EmergencyContact[];
  healthProfile: HealthProfile | null;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface SensorData {
  heartRate: number;
  spo2: number;
  hrv: number;
  timestamp: string;
}

export interface Prediction {
  riskLevel: 'healthy' | 'moderate' | 'high' | 'critical';
  riskScore: number;
  probability: number;
  timestamp: string;
}

export interface Dcsi {
  score: number;
  heartRateScore: number;
  spo2Score: number;
  hrvScore: number;
  activityScore: number;
  riskLevel: 'healthy' | 'moderate' | 'high' | 'critical';
  date: string;
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  type: 'critical_hr' | 'critical_spo2' | 'fall_detected' | 'manual';
  location: GeoLocation;
  timestamp: string;
  status: 'active' | 'resolved';
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface BLESensorData {
  heartRate: number;
  spo2: number;
  temperature: number;
  battery: number;
  timestamp: number;
}

export interface BLEState {
  isScanning: boolean;
  isConnected: boolean;
  deviceName: string | null;
  deviceId: string | null;
  sensorData: BLESensorData | null;
  error: string | null;
}

export type ThemeMode = 'light' | 'dark';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
