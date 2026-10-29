import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { bluetoothManager } from '../services/bluetooth';

export function useBluetooth() {
  const {
    bleStatus,
    bleDeviceName,
    bleDeviceId,
    bleSensorData,
    bleError,
    clearBleError,
  } = useAppStore();

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    return bluetoothManager.requestPermissions();
  }, []);

  const startScanning = useCallback(async (): Promise<void> => {
    await bluetoothManager.startScanning();
  }, []);

  const stopScanning = useCallback((): void => {
    bluetoothManager.stopScanning();
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    await bluetoothManager.connectToDevice();
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    await bluetoothManager.disconnect();
  }, []);

  return {
    bleStatus,
    bleDeviceName,
    bleDeviceId,
    bleSensorData,
    bleError,
    isScanning: bleStatus === 'scanning',
    isConnected: bleStatus === 'connected',
    requestPermissions,
    startScanning,
    stopScanning,
    connect,
    disconnect,
    clearBleError,
  };
}
