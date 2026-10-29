import type { BLESensorData } from '../../types';

const REQUIRED_FIELDS_SNAKE = ['heart_rate', 'spo2', 'temperature', 'battery', 'timestamp'] as const;

export function parseSensorPayload(payload: string): BLESensorData | null {
  try {
    const data = JSON.parse(payload) as Record<string, unknown>;

    const hasAllFields = REQUIRED_FIELDS_SNAKE.every((field) => {
      const value = data[field];
      return value !== undefined && value !== null;
    });

    if (!hasAllFields) {
      return null;
    }

    const parsed: BLESensorData = {
      heartRate: Number(data.heart_rate),
      spo2: Number(data.spo2),
      temperature: Number(data.temperature),
      battery: Number(data.battery),
      timestamp: Number(data.timestamp),
    };

    if (
      isNaN(parsed.heartRate) ||
      isNaN(parsed.spo2) ||
      isNaN(parsed.temperature) ||
      isNaN(parsed.battery) ||
      isNaN(parsed.timestamp)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
