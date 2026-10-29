import type {
  User,
  SensorData,
  Prediction,
  Dcsi,
  EmergencyAlert,
  EmergencyContact,
  AuthResponse,
  HealthProfile,
} from '../../types';

const randomBetween = (min: number, max: number) =>
  Math.round(Math.random() * (max - min) + min);

const randomFloat = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const MOCK_USER: User = {
  id: 'user-001',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  phone: '+1-555-0123',
  emergencyContacts: [
    { id: 'ec-001', name: 'Sarah Johnson', phone: '+1-555-0124', relationship: 'Spouse' },
    { id: 'ec-002', name: 'Dr. Michael Chen', phone: '+1-555-0125', relationship: 'Physician' },
  ],
  healthProfile: null,
  createdAt: '2025-01-15T08:00:00Z',
};

function generateSensorData(overrides?: Partial<SensorData>): SensorData {
  return {
    heartRate: randomBetween(62, 110),
    spo2: randomBetween(94, 100),
    hrv: randomBetween(30, 80),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function generatePrediction(sensor?: SensorData): Prediction {
  const hr = sensor?.heartRate ?? randomBetween(62, 110);
  const spo2 = sensor?.spo2 ?? randomBetween(94, 100);
  const hrHigh = hr > 100;
  const spo2Low = spo2 < 94;
  const critical = hr > 120 || spo2 < 90;
  const high = hr > 100 || spo2 < 93;
  const moderate = hr > 85 || spo2 < 95;

  const riskLevel = critical ? 'critical' : high ? 'high' : moderate ? 'moderate' : 'healthy';
  const scoreMap = { healthy: randomBetween(5, 30), moderate: randomBetween(31, 60), high: randomBetween(61, 80), critical: randomBetween(81, 100) };

  return {
    riskLevel,
    riskScore: scoreMap[riskLevel],
    probability: randomFloat(0.75, 0.97),
    timestamp: new Date().toISOString(),
  };
}

function generateDcsi(sensor?: SensorData): Dcsi {
  const hr = sensor?.heartRate ?? randomBetween(62, 110);
  const spo2 = sensor?.spo2 ?? randomBetween(94, 100);
  const hrv = sensor?.hrv ?? randomBetween(30, 80);

  const heartRateScore = Math.min(100, Math.max(0, ((hr - 40) / 80) * 100));
  const spo2Score = Math.min(100, Math.max(0, (1 - (100 - spo2) / 10) * 100));
  const hrvScore = Math.min(100, Math.max(0, (1 - hrv / 200) * 100));
  const activityScore = randomBetween(20, 70);

  const score = Math.round(
    heartRateScore * 0.35 + spo2Score * 0.25 + hrvScore * 0.2 + activityScore * 0.2,
  );

  const riskLevel = score <= 30 ? 'healthy' : score <= 60 ? 'moderate' : score <= 80 ? 'high' : 'critical';

  return {
    score,
    heartRateScore: Math.round(heartRateScore),
    spo2Score: Math.round(spo2Score),
    hrvScore: Math.round(hrvScore),
    activityScore: Math.round(activityScore),
    riskLevel,
    date: new Date().toISOString().split('T')[0],
  };
}

export function generateSensorHistory(count: number): SensorData[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) =>
    generateSensorData({
      timestamp: new Date(now - (count - i) * 300000).toISOString(),
      heartRate: randomBetween(65, 105),
      spo2: randomBetween(93, 100),
      hrv: randomBetween(28, 85),
    }),
  );
}

export function generateDcsiHistory(count: number): Dcsi[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    ...generateDcsi(),
    date: new Date(now - (count - i) * 86400000).toISOString().split('T')[0],
  }));
}

export function generatePredictionHistory(count: number): Prediction[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    ...generatePrediction(),
    timestamp: new Date(now - (count - i) * 86400000).toISOString(),
  }));
}

export const mockApi = {
  auth: {
    login: async (_data: { email: string; password: string }): Promise<AuthResponse> => {
      await delay(800);
      return { token: 'mock-jwt-token-' + Date.now(), user: MOCK_USER };
    },
    register: async (_data: { name: string; email: string; password: string }): Promise<AuthResponse> => {
      await delay(1000);
      return { token: 'mock-jwt-token-' + Date.now(), user: MOCK_USER };
    },
    profile: async (): Promise<User> => {
      await delay(300);
      return MOCK_USER;
    },
    updateHealthProfile: async (profile: HealthProfile): Promise<User> => {
      await delay(500);
      MOCK_USER.healthProfile = profile;
      return MOCK_USER;
    },
  },
  sensor: {
    latest: async (): Promise<SensorData> => {
      await delay(400);
      return generateSensorData();
    },
    history: async (_params?: { limit?: number }): Promise<SensorData[]> => {
      await delay(500);
      return generateSensorHistory(_params?.limit ?? 20);
    },
  },
  prediction: {
    latest: async (): Promise<Prediction> => {
      await delay(400);
      const sensor = generateSensorData();
      return generatePrediction(sensor);
    },
    history: async (_params?: { limit?: number }): Promise<Prediction[]> => {
      await delay(500);
      return generatePredictionHistory(_params?.limit ?? 14);
    },
  },
  dcsi: {
    current: async (): Promise<Dcsi> => {
      await delay(400);
      return generateDcsi();
    },
    history: async (_params?: { limit?: number }): Promise<Dcsi[]> => {
      await delay(500);
      return generateDcsiHistory(_params?.limit ?? 14);
    },
  },
  emergency: {
    alerts: async (): Promise<EmergencyAlert[]> => {
      await delay(300);
      return [];
    },
    trigger: async (type: EmergencyAlert['type'], location: { latitude: number; longitude: number }): Promise<EmergencyAlert> => {
      await delay(600);
      return {
        id: 'alert-' + Date.now(),
        userId: MOCK_USER.id,
        type,
        location,
        timestamp: new Date().toISOString(),
        status: 'active',
      };
    },
    contacts: async (): Promise<EmergencyContact[]> => {
      await delay(300);
      return MOCK_USER.emergencyContacts;
    },
    addContact: async (contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> => {
      await delay(400);
      const newContact = { ...contact, id: 'ec-' + Date.now() };
      MOCK_USER.emergencyContacts.push(newContact);
      return newContact;
    },
    removeContact: async (id: string): Promise<void> => {
      await delay(300);
      const idx = MOCK_USER.emergencyContacts.findIndex((c) => c.id === id);
      if (idx !== -1) MOCK_USER.emergencyContacts.splice(idx, 1);
    },
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
