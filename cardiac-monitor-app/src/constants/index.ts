// Live data comes from the ESP32 wearable over BLE and the backend /predict
// endpoint. Set to `true` only for UI work without hardware or a server.
export const USE_MOCK_DATA = false;

export const API_ENDPOINTS = {
  HEALTH: '/health',
  PREDICT: '/predict',
  SENSOR_DATA: '/sensor-data',
  DASHBOARD: (userId: string) => `/dashboard/${userId}`,
  HISTORY: (userId: string) => `/history/${userId}`,
  EMERGENCY: '/emergency',
  EMERGENCY_CONTACTS: (userId: string) => `/emergency/contacts/${userId}`,
  EMERGENCY_ADD_CONTACT: '/emergency/contacts',
  EMERGENCY_DELETE_CONTACT: (contactId: string | number) => `/emergency/contacts/${contactId}`,
  EMERGENCY_ALERTS: (userId: string) => `/emergency/alerts/${userId}`,
  EMERGENCY_RESOLVE: (alertId: string | number) => `/emergency/resolve/${alertId}`,
  USERS: '/users',
  USER_PROFILE: (userId: string) => `/users/${userId}`,
} as const;

export const RISK_THRESHOLDS = {
  HEALTHY_MAX: 30,
  MODERATE_MAX: 60,
  HIGH_MAX: 80,
  CRITICAL_MIN: 81,
} as const;

export const SENSOR_LIMITS = {
  HEART_RATE: { MIN: 40, MAX: 220 },
  SPO2: { MIN: 70, MAX: 100 },
  HRV: { MIN: 20, MAX: 200 },
} as const;

// Must match the backend's PredictionInput enum (app/schemas/prediction.py)
export const ACTIVITY_LEVELS = [
  'Sedentary',
  'Lightly Active',
  'Moderately Active',
  'Very Active',
] as const;

export const GENDERS = ['Male', 'Female'] as const;

// Must match the backend's PredictionInput field bounds (app/schemas/prediction.py)
export const HEALTH_PROFILE_LIMITS = {
  AGE: { MIN: 18, MAX: 90 },
  HEIGHT_CM: { MIN: 140, MAX: 220 },
  WEIGHT_KG: { MIN: 35, MAX: 160 },
  SLEEP_HOURS: { MIN: 2, MAX: 12 },
  STRESS_LEVEL: { MIN: 0, MAX: 100 },
  HEART_RATE_VARIABILITY: { MIN: 10, MAX: 130 },
} as const;
