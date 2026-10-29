import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User,
  SensorData,
  Prediction,
  Dcsi,
  EmergencyAlert,
  ThemeMode,
  BLESensorData,
} from '../types';

export type BLEConnectionStatus =
  'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

// Lifecycle of the backend /predict loop (see hooks/usePrediction.ts):
//  idle    — no readings yet, loop not started
//  pending — readings flowing, waiting on the first /predict response
//  ok      — last /predict call succeeded
//  error   — last /predict call failed (see predictionError for why)
export type PredictionStatus = 'idle' | 'pending' | 'ok' | 'error';

interface AppState {
  theme: ThemeMode;
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  currentSensorData: SensorData | null;
  currentPrediction: Prediction | null;
  currentDcsi: Dcsi | null;
  predictionStatus: PredictionStatus;
  predictionError: string | null;
  vitalsLog: SensorData[];
  emergencyAlerts: EmergencyAlert[];
  /** Phone number that manual SOS and automatic critical alerts are texted to. */
  sosContactNumber: string | null;
  isLoading: boolean;

  bleStatus: BLEConnectionStatus;
  bleDeviceName: string | null;
  bleDeviceId: string | null;
  bleSensorData: BLESensorData | null;
  lastBleSensorData: BLESensorData | null;
  bleError: string | null;

  setTheme: (theme: ThemeMode) => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuthenticated: (value: boolean) => void;
  setCurrentSensorData: (data: SensorData | null) => void;
  setCurrentPrediction: (prediction: Prediction | null) => void;
  setCurrentDcsi: (dcsi: Dcsi | null) => void;
  setPredictionStatus: (status: PredictionStatus) => void;
  setPredictionError: (error: string | null) => void;
  pushVital: (reading: SensorData) => void;
  setEmergencyAlerts: (alerts: EmergencyAlert[]) => void;
  setSosContactNumber: (phone: string | null) => void;
  setIsLoading: (loading: boolean) => void;

  setBleStatus: (status: BLEConnectionStatus) => void;
  setBleDeviceName: (name: string | null) => void;
  setBleDeviceId: (id: string | null) => void;
  setBleSensorData: (data: BLESensorData | null) => void;
  setLastBleSensorData: (data: BLESensorData | null) => void;
  setBleError: (error: string | null) => void;
  clearBleError: () => void;

  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light' as ThemeMode,
      user: null,
      token: null,
      isAuthenticated: false,
      currentSensorData: null,
      currentPrediction: null,
      currentDcsi: null,
      predictionStatus: 'idle' as PredictionStatus,
      predictionError: null,
      vitalsLog: [],
      emergencyAlerts: [],
      sosContactNumber: null,
      isLoading: false,

      bleStatus: 'idle',
      bleDeviceName: null,
      bleDeviceId: null,
      bleSensorData: null,
      lastBleSensorData: null,
      bleError: null,

      setTheme: (theme: ThemeMode) => set({ theme }),
      setUser: (user: User | null) => set({ user }),
      setToken: (token: string | null) => set({ token }),
      setAuthenticated: (value: boolean) => set({ isAuthenticated: value }),
      setCurrentSensorData: (data: SensorData | null) => set({ currentSensorData: data }),
      setCurrentPrediction: (prediction: Prediction | null) =>
        set({ currentPrediction: prediction }),
      setCurrentDcsi: (dcsi: Dcsi | null) => set({ currentDcsi: dcsi }),
      setPredictionStatus: (predictionStatus: PredictionStatus) => set({ predictionStatus }),
      setPredictionError: (predictionError: string | null) => set({ predictionError }),
      pushVital: (reading: SensorData) =>
        set((state) => ({ vitalsLog: [...state.vitalsLog, reading].slice(-240) })),
      setEmergencyAlerts: (alerts: EmergencyAlert[]) => set({ emergencyAlerts: alerts }),
      setSosContactNumber: (sosContactNumber: string | null) => set({ sosContactNumber }),
      setIsLoading: (loading: boolean) => set({ isLoading: loading }),

      setBleStatus: (bleStatus: BLEConnectionStatus) => set({ bleStatus }),
      setBleDeviceName: (bleDeviceName: string | null) => set({ bleDeviceName }),
      setBleDeviceId: (bleDeviceId: string | null) => set({ bleDeviceId }),
      setBleSensorData: (bleSensorData: BLESensorData | null) => set({ bleSensorData }),
      setLastBleSensorData: (lastBleSensorData: BLESensorData | null) => set({ lastBleSensorData }),
      setBleError: (bleError: string | null) => set({ bleError }),
      clearBleError: () => set({ bleError: null }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          currentSensorData: null,
          currentPrediction: null,
          currentDcsi: null,
          predictionStatus: 'idle',
          predictionError: null,
          vitalsLog: [],
          emergencyAlerts: [],
          sosContactNumber: null,
          bleStatus: 'idle',
          bleDeviceName: null,
          bleDeviceId: null,
          bleSensorData: null,
          lastBleSensorData: null,
          bleError: null,
        }),
    }),
    {
      name: '@cardiac_monitor_store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only identity/session state survives a restart — live sensor/BLE/prediction
      // state is meant to be re-established fresh on every launch, not replayed stale.
      partialize: (state) => ({
        theme: state.theme,
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        sosContactNumber: state.sosContactNumber,
      }),
    },
  ),
);
