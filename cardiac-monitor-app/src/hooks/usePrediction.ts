import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { useAppStore } from '../store/useAppStore';
import { PredictionService } from '../services/bluetooth';
import { sendAutomaticSms } from '../services/nativeSms';
import { getEmergencyContacts, triggerEmergencyAlert } from '../services/api/emergency';
import type { Dcsi, Prediction, SensorData } from '../types';

/**
 * Bridges the live BLE sensor stream into the app store.
 *
 * - mirrors each BLE reading into `currentSensorData` (+ a session `vitalsLog`)
 *   so the Dashboard / History screens show real hardware values, and
 * - runs the backend `/predict` loop, writing `currentPrediction` and
 *   `currentDcsi`.
 *
 * Mount once, high in the tree (see `MainTabs`), not per-screen.
 */
function toDcsi(score: number): Dcsi {
  const s = Math.round(score);
  return {
    score: s,
    // The /predict response only carries the composite score; sub-scores are
    // not broken out server-side (see docs/INTEGRATION.md gap #4).
    heartRateScore: 0,
    spo2Score: 0,
    hrvScore: 0,
    activityScore: 0,
    riskLevel: s <= 30 ? 'healthy' : s <= 60 ? 'moderate' : s <= 80 ? 'high' : 'critical',
    date: new Date().toISOString().split('T')[0],
  };
}

export function usePrediction() {
  const serviceRef = useRef<PredictionService | null>(null);
  const startedRef = useRef(false);

  const setCurrentPrediction = useAppStore((s) => s.setCurrentPrediction);
  const setCurrentDcsi = useAppStore((s) => s.setCurrentDcsi);
  const setCurrentSensorData = useAppStore((s) => s.setCurrentSensorData);
  const setPredictionStatus = useAppStore((s) => s.setPredictionStatus);
  const setPredictionError = useAppStore((s) => s.setPredictionError);
  const pushVital = useAppStore((s) => s.pushVital);
  const bleSensorData = useAppStore((s) => s.bleSensorData);
  const user = useAppStore((s) => s.user);
  const criticalStreakRef = useRef(0);
  const lastAlertAtRef = useRef(0);
  const alertInFlightRef = useRef(false);

  const triggerAutomaticAlert = useCallback(
    async (prediction: Prediction) => {
      const sensor = useAppStore.getState().bleSensorData;
      if (!sensor || alertInFlightRef.current) return;

      const now = Date.now();
      const cooldownMs = 15 * 60 * 1000;
      if (now - lastAlertAtRef.current < cooldownMs) return;

      alertInFlightRef.current = true;
      try {
        const state = useAppStore.getState();
        const configuredContacts = state.user?.emergencyContacts ?? [];
        const contacts =
          configuredContacts.length > 0 ? configuredContacts : await getEmergencyContacts();
        const sosNumber = state.sosContactNumber?.trim();
        const recipients = [
          ...contacts,
          ...(sosNumber && !contacts.some((contact) => contact.phone === sosNumber)
            ? [
                {
                  id: 'sos-number',
                  name: 'Emergency contact',
                  phone: sosNumber,
                  relationship: 'SOS',
                },
              ]
            : []),
        ];
        if (recipients.length === 0) {
          throw new Error('No emergency contacts are configured.');
        }

        const locationPermission = await Location.requestForegroundPermissionsAsync();
        if (locationPermission.status !== 'granted') {
          throw new Error('Location permission is required for an emergency alert.');
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const { latitude, longitude } = position.coords;
        const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
        const message = [
          'EMERGENCY ALERT',
          `${user?.name ?? 'A family member'} has a critical cardiac-risk reading.`,
          `Heart rate: ${Math.round(sensor.heartRate)} BPM`,
          `SpO2: ${Math.round(sensor.spo2)}%`,
          `Risk: ${prediction.riskLevel.toUpperCase()} (${Math.round(prediction.riskScore)})`,
          `Location: ${locationUrl}`,
        ].join('\n');

        try {
          await triggerEmergencyAlert(
            sensor.spo2 < 90 ? 'critical_spo2' : 'critical_hr',
            { latitude, longitude },
            Math.round(sensor.heartRate),
            Math.round(sensor.spo2),
            message,
          );
        } catch (error) {
          // SMS remains a local emergency path if the backend is unavailable.
          console.warn('Emergency event could not be logged:', error);
        }

        const results = await Promise.allSettled(
          recipients.map((contact) => sendAutomaticSms(contact.phone, message)),
        );
        const sentCount = results.filter((result) => result.status === 'fulfilled').length;
        if (sentCount === 0) {
          throw new Error('The emergency SMS could not be sent to any contact.');
        }
        lastAlertAtRef.current = now;
      } catch (error) {
        console.warn('Automatic emergency SMS failed:', error);
      } finally {
        alertInFlightRef.current = false;
      }
    },
    [user],
  );

  const handleResult = useCallback(
    (prediction: Prediction, dcsi: number) => {
      setCurrentPrediction(prediction);
      if (typeof dcsi === 'number' && !Number.isNaN(dcsi)) {
        setCurrentDcsi(toDcsi(dcsi));
      }
      setPredictionStatus('ok');
      setPredictionError(null);

      const critical = prediction.riskLevel === 'critical' || prediction.riskScore >= 81;
      criticalStreakRef.current = critical ? criticalStreakRef.current + 1 : 0;
      if (criticalStreakRef.current >= 3) {
        void triggerAutomaticAlert(prediction);
      }
    },
    [
      setCurrentPrediction,
      setCurrentDcsi,
      setPredictionStatus,
      setPredictionError,
      triggerAutomaticAlert,
    ],
  );

  const handleError = useCallback(
    (message: string) => {
      setPredictionStatus('error');
      setPredictionError(message);
    },
    [setPredictionStatus, setPredictionError],
  );

  useEffect(() => {
    const service = new PredictionService(handleResult, handleError, (message) => {
      // Keep prediction status successful when only persistence failed, but
      // surface the data-loss risk through the existing live-monitoring error.
      setPredictionError(message);
    });
    serviceRef.current = service;
    return () => {
      service.stop();
      serviceRef.current = null;
      startedRef.current = false;
      criticalStreakRef.current = 0;
      alertInFlightRef.current = false;
      setPredictionStatus('idle');
      setPredictionError(null);
    };
  }, [handleResult, handleError, setPredictionStatus, setPredictionError]);

  useEffect(() => {
    if (!bleSensorData) return;

    // Mirror the live reading into the generic slots the dashboards read.
    // The wearable does not measure HRV; keep it 0 until the firmware does.
    const reading: SensorData = {
      heartRate: Math.round(bleSensorData.heartRate),
      spo2: Math.round(bleSensorData.spo2),
      hrv: 0,
      timestamp: new Date().toISOString(),
    };
    setCurrentSensorData(reading);
    pushVital(reading);

    const service = serviceRef.current;
    if (!service) return;
    service.updateSensorData(bleSensorData);
    if (!startedRef.current) {
      service.start();
      startedRef.current = true;
      setPredictionStatus('pending');
    }
  }, [bleSensorData, setCurrentSensorData, pushVital, setPredictionStatus]);
}
