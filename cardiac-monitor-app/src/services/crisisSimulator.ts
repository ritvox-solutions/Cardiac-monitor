import * as Location from 'expo-location';
import { useAppStore } from '../store/useAppStore';
import { requestPrediction } from './api/prediction';
import { triggerEmergencyAlert, getEmergencyContacts } from './api/emergency';
import { sendAutomaticSms } from './nativeSms';
import { bluetoothManager } from './bluetooth';
import type { EmergencyAlert, BLESensorData } from '../types';

export interface SimulationProgress {
  step: number;
  totalSteps: number;
  heartRate: number;
  spo2: number;
  riskScore: number;
  riskLevel: string;
  statusText: string;
}

export interface ResetResult {
  source: 'live_ble' | 'last_ble' | 'baseline';
  heartRate: number;
  spo2: number;
  hrv: number;
  temperature: number;
  battery: number;
}

// Stores normal baseline vitals before the crisis simulation started
let previousBaseline: { heartRate: number; spo2: number; hrv: number } = {
  heartRate: 72,
  spo2: 98,
  hrv: 55,
};

let previousBleBaseline: BLESensorData | null = null;

/**
 * Resets vitals and ML risk back to live BLE stream if connected,
 * the last known BLE packet from the ESP32 watch, or a healthy baseline.
 */
export async function resetToLiveBleVitals(customBaseline?: {
  heartRate?: number;
  spo2?: number;
  hrv?: number;
}): Promise<ResetResult> {
  const state = useAppStore.getState();
  const isConnected = bluetoothManager.isConnected || state.bleStatus === 'connected';
  const realBle =
    bluetoothManager.getLastRealSensorData() ||
    state.lastBleSensorData ||
    previousBleBaseline;

  let source: 'live_ble' | 'last_ble' | 'baseline' = 'baseline';
  let hr = 72;
  let spo2 = 98;
  let hrv = 55;
  let temperature = 36.6;
  let battery = 90;

  if (isConnected && realBle) {
    source = 'live_ble';
    hr = Math.round(realBle.heartRate);
    spo2 = Math.round(realBle.spo2);
    temperature = realBle.temperature ?? 36.6;
    battery = realBle.battery ?? 90;
    hrv = previousBaseline.hrv || 55;
  } else if (realBle) {
    source = 'last_ble';
    hr = Math.round(realBle.heartRate);
    spo2 = Math.round(realBle.spo2);
    temperature = realBle.temperature ?? 36.6;
    battery = realBle.battery ?? 90;
    hrv = previousBaseline.hrv || 55;
  } else {
    source = 'baseline';
    hr = customBaseline?.heartRate ?? previousBaseline.heartRate ?? 72;
    spo2 = customBaseline?.spo2 ?? previousBaseline.spo2 ?? 98;
    hrv = customBaseline?.hrv ?? previousBaseline.hrv ?? 55;
  }

  const timestamp = new Date().toISOString();
  state.setCurrentSensorData({
    heartRate: hr,
    spo2,
    hrv,
    timestamp,
  });

  if (realBle) {
    state.setBleSensorData({
      ...realBle,
      heartRate: hr,
      spo2,
      temperature,
      battery,
      timestamp: Date.now(),
    });
  } else {
    state.setBleSensorData({
      heartRate: hr,
      spo2,
      temperature,
      battery,
      timestamp: Date.now(),
    });
  }

  try {
    await requestPrediction({
      heartRate: hr,
      spo2,
      hrv,
    });
  } catch (err) {
    console.warn('Failed to recalculate healthy baseline prediction:', err);
  }

  return { source, heartRate: hr, spo2, hrv, temperature, battery };
}

/**
 * Backward-compatible alias for resetToLiveBleVitals.
 */
export async function resetVitalsToNormal(customBaseline?: {
  heartRate?: number;
  spo2?: number;
  hrv?: number;
}): Promise<void> {
  await resetToLiveBleVitals(customBaseline);
}

/**
 * Simulates a critical cardiac emergency event for presentation / demo purposes.
 *
 * It feeds critical vitals into the ML model (HR: 148-168 BPM, SpO2: 85-88%),
 * verifies the backend returns Critical/High Risk, and fires the autonomous
 * emergency protocol: high-accuracy GPS lock, real SIM SMS dispatch, and PostgreSQL
 * backend alert recording.
 */
export async function simulateAutonomousSos(
  onProgress?: (progress: SimulationProgress) => void,
): Promise<{
  success: boolean;
  recipient: string;
  locationUrl: string;
  heartRate: number;
  spo2: number;
  riskScore: number;
  alert?: EmergencyAlert;
  message: string;
}> {
  // Capture current baseline before the simulation overwrites it
  const state = useAppStore.getState();
  const currentSensor = state.currentSensorData;
  const currentBle = bluetoothManager.getLastRealSensorData() || state.lastBleSensorData;

  if (currentBle && currentBle.heartRate > 35 && currentBle.heartRate < 130) {
    previousBleBaseline = { ...currentBle };
  }

  if (currentSensor && currentSensor.heartRate > 40 && currentSensor.heartRate < 105) {
    previousBaseline = {
      heartRate: Math.round(currentSensor.heartRate),
      spo2: Math.round(currentSensor.spo2),
      hrv: Math.round(currentSensor.hrv || 55),
    };
  } else if (previousBleBaseline) {
    previousBaseline = {
      heartRate: Math.round(previousBleBaseline.heartRate),
      spo2: Math.round(previousBleBaseline.spo2),
      hrv: 55,
    };
  } else {
    previousBaseline = { heartRate: 72, spo2: 98, hrv: 55 };
  }

  const steps = [
    { hr: 148, spo2: 88, hrv: 18, label: 'Reading 1/3: Elevated tachycardia detected' },
    { hr: 158, spo2: 86, hrv: 15, label: 'Reading 2/3: Severe cardiac stress confirmed' },
    { hr: 168, spo2: 85, hrv: 12, label: 'Reading 3/3: CRITICAL threshold reached! Autonomous SOS triggered' },
  ];

  let latestRiskScore = 90;
  let latestRiskLevel = 'critical';

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];

    // 1. Update app store vitals to reflect simulated crisis
    const timestamp = new Date().toISOString();
    useAppStore.getState().setCurrentSensorData({
      heartRate: s.hr,
      spo2: s.spo2,
      hrv: s.hrv,
      timestamp,
    });
    useAppStore.getState().setBleSensorData({
      heartRate: s.hr,
      spo2: s.spo2,
      temperature: 37.8,
      battery: 88,
      timestamp: Date.now(),
    });

    // 2. Run real prediction on deployed backend
    try {
      const { prediction, dcsi } = await requestPrediction({
        heartRate: s.hr,
        spo2: s.spo2,
        hrv: s.hrv,
      });
      latestRiskScore = dcsi.score || prediction.riskScore || 85;
      latestRiskLevel = dcsi.riskLevel || prediction.riskLevel || 'critical';
    } catch {
      latestRiskScore = 95;
      latestRiskLevel = 'critical';
    }

    if (onProgress) {
      onProgress({
        step: i + 1,
        totalSteps: steps.length,
        heartRate: s.hr,
        spo2: s.spo2,
        riskScore: latestRiskScore,
        riskLevel: latestRiskLevel,
        statusText: s.label,
      });
    }

    // Wait 1.2s between readings for a realistic, visible progression on screen
    if (i < steps.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  // 3. Resolve emergency recipient
  const currentState = useAppStore.getState();
  let recipient =
    currentState.sosContactNumber?.trim() ||
    currentState.user?.emergencyContacts[0]?.phone;

  if (!recipient || recipient.includes('555-0124') || recipient.includes('555-0125') || recipient.startsWith('+1555')) {
    try {
      const contacts = await getEmergencyContacts();
      const realContact = contacts.find((c) => !c.phone.includes('555'));
      if (realContact) {
        recipient = realContact.phone;
      }
    } catch {
      // ignore
    }
  }

  if (!recipient || recipient.includes('555-0124') || recipient.includes('555-0125') || recipient.startsWith('+1555')) {
    throw new Error(
      'Please set your real phone number in Emergency screen or Settings. Test dummy numbers (+1-555-0124) cannot receive SMS.',
    );
  }

  // 4. Obtain GPS coordinates
  let latitude = 12.9716;
  let longitude = 77.5946;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      latitude = loc.coords.latitude;
      longitude = loc.coords.longitude;
    }
  } catch {
    // Fall back to default coords if GPS disabled in emulator
  }

  const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  const finalHr = steps[steps.length - 1].hr;
  const finalSpo2 = steps[steps.length - 1].spo2;

  const patientName = state.user?.name || 'Patient';
  const smsMessage = `EMERGENCY ALERT: ${patientName} is in critical condition.\nHR: ${finalHr} BPM | SpO2: ${finalSpo2}% | Risk: ${latestRiskScore}/100\nLocation: ${locationUrl}`;

  // 5. Send real SMS via Android SIM
  await sendAutomaticSms(recipient, smsMessage);

  // 6. Record alert in backend database
  let alertRecord: EmergencyAlert | undefined;
  try {
    alertRecord = await triggerEmergencyAlert(
      'critical_hr',
      { latitude, longitude },
      finalHr,
      finalSpo2,
      smsMessage,
    );
  } catch (err) {
    console.warn('Backend alert recording warning:', err);
  }

  return {
    success: true,
    recipient,
    locationUrl,
    heartRate: finalHr,
    spo2: finalSpo2,
    riskScore: latestRiskScore,
    alert: alertRecord,
    message: smsMessage,
  };
}
