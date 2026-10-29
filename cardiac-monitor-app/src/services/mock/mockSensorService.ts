import { useAppStore } from '../../store/useAppStore';
import { SensorData, Prediction, Dcsi } from '../../types';

class MockSensorService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentHeartRate = 75;
  private currentSpo2 = 98;
  private currentTemperature = 36.6;
  private currentBattery = 85;

  private getRandom(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private getRandomInt(min: number, max: number) {
    return Math.floor(this.getRandom(min, max));
  }

  private updateValues() {
    // Gradual changes: +/- 1 or 2
    const hrDiff = this.getRandomInt(-2, 3);
    this.currentHeartRate = Math.max(68, Math.min(95, this.currentHeartRate + hrDiff));

    const spo2Diff = Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0;
    this.currentSpo2 = Math.max(96, Math.min(100, this.currentSpo2 + spo2Diff));

    const tempDiff = this.getRandom(-0.05, 0.05);
    this.currentTemperature = parseFloat(
      Math.max(36.2, Math.min(37.2, this.currentTemperature + tempDiff)).toFixed(1),
    );

    // Battery decreases slowly
    if (Math.random() > 0.99) {
      this.currentBattery = Math.max(0, this.currentBattery - 1);
    }

    const sensorData: SensorData = {
      heartRate: this.currentHeartRate,
      spo2: this.currentSpo2,
      hrv: this.getRandomInt(40, 70),
      timestamp: new Date().toISOString(),
    };

    const riskScore = this.getRandomInt(10, 85);
    const riskLevel: Prediction['riskLevel'] =
      riskScore < 30
        ? 'healthy'
        : riskScore < 60
          ? 'moderate'
          : riskScore < 80
            ? 'high'
            : 'critical';

    const prediction: Prediction = {
      riskLevel,
      riskScore,
      probability: this.getRandom(0.85, 0.99),
      timestamp: sensorData.timestamp,
    };

    const dcsi: Dcsi = {
      score: this.getRandomInt(15, 80),
      heartRateScore: this.getRandomInt(60, 95),
      spo2Score: this.getRandomInt(90, 100),
      hrvScore: this.getRandomInt(50, 80),
      activityScore: this.getRandomInt(30, 90),
      riskLevel,
      date: new Date().toISOString().split('T')[0],
    };

    // Update store
    const store = useAppStore.getState();
    store.setCurrentSensorData(sensorData);
    store.setCurrentPrediction(prediction);
    store.setCurrentDcsi(dcsi);
  }

  start() {
    if (this.interval) return;
    console.log('Mock Service Started');
    this.updateValues(); // Initial update
    this.interval = setInterval(() => {
      this.updateValues();
      console.log('Mock Reading Generated');
    }, 60000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('Mock Service Stopped');
    }
  }

  getHistory(count = 20): SensorData[] {
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => ({
      heartRate: this.getRandomInt(70, 90),
      spo2: this.getRandomInt(95, 99),
      hrv: this.getRandomInt(45, 65),
      timestamp: new Date(now - (count - i) * 60000).toISOString(),
    }));
  }
}

export const mockSensorService = new MockSensorService();
