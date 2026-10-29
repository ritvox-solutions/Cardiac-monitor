import { BleManager, Device } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { BLEScanner } from './BLEScanner';
import { BLEConnection } from './BLEConnection';
import type { BLESensorData } from '../../types';
import { useAppStore } from '../../store/useAppStore';

export type BLEStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface BLEStateUpdate {
  status: BLEStatus;
  deviceName?: string | null;
  deviceId?: string | null;
  sensorData?: BLESensorData | null;
  error?: string | null;
}

let sharedBleManager: BleManager | null = null;

export function getBleManager(): BleManager {
  if (!sharedBleManager) {
    sharedBleManager = new BleManager();
  }
  return sharedBleManager;
}

export class BluetoothManager {
  private static instance: BluetoothManager | null = null;
  private manager: BleManager;
  private scanner: BLEScanner;
  private connection: BLEConnection;
  private listeners: Set<(update: BLEStateUpdate) => void>;
  private foundDevice: Device | null;
  private _status: BLEStatus;
  private lastRealSensorData: BLESensorData | null = null;

  public static getInstance(): BluetoothManager {
    if (!BluetoothManager.instance) {
      BluetoothManager.instance = new BluetoothManager();
    }
    return BluetoothManager.instance;
  }

  public getLastRealSensorData(): BLESensorData | null {
    return this.lastRealSensorData;
  }

  constructor(onStateChange?: (update: BLEStateUpdate) => void) {
    this.manager = getBleManager();
    this.listeners = new Set();
    if (onStateChange) {
      this.listeners.add(onStateChange);
    }
    this.foundDevice = null;
    this._status = 'idle';

    this.scanner = new BLEScanner(
      this.manager,
      this.handleDeviceFound.bind(this),
      this.handleError.bind(this),
    );

    this.connection = new BLEConnection(
      this.manager,
      this.handleSensorData.bind(this),
      this.handleDisconnect.bind(this),
      this.handleError.bind(this),
    );
  }

  public subscribe(listener: (update: BLEStateUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get status(): BLEStatus {
    return this._status;
  }

  get isConnected(): boolean {
    return this.connection.isConnected;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const allGranted = Object.values(granted).every(
        (value) => value === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (!allGranted) {
        this.handleError('Bluetooth permissions denied');
        return false;
      }

      return true;
    } catch {
      this.handleError('Failed to request Bluetooth permissions');
      return false;
    }
  }

  async startScanning(): Promise<void> {
    this._status = 'scanning';
    this.foundDevice = null;
    this.notifyStateChange({ status: 'scanning' });
    await this.scanner.start();
  }

  stopScanning(): void {
    this.scanner.stop();
    if (this._status === 'scanning') {
      this._status = 'idle';
      this.notifyStateChange({ status: 'idle' });
    }
  }

  async connectToDevice(): Promise<void> {
    if (!this.foundDevice) {
      this.handleError('No ESP32 device found to connect. Scanning...');
      await this.startScanning();
      return;
    }

    this._status = 'connecting';
    this.notifyStateChange({ status: 'connecting', deviceName: this.foundDevice.name ?? 'ESP32' });
    try {
      await this.connection.connect(this.foundDevice);
      if (this.connection.isConnected) {
        this._status = 'connected';
        this.notifyStateChange({
          status: 'connected',
          deviceName: this.connection.connectedDeviceName ?? this.foundDevice.name ?? 'ESP32',
          deviceId: this.connection.connectedDeviceId ?? this.foundDevice.id,
        });
      }
    } catch (err) {
      this.handleError(err instanceof Error ? err.message : 'Failed to connect to watch');
    }
  }

  async disconnect(): Promise<void> {
    this._status = 'disconnected';
    this.notifyStateChange({ status: 'disconnected' });
    await this.connection.disconnect();
  }

  destroy(): void {
    this.scanner.stop();
    void this.connection.disconnect();
    // Do NOT call this.manager.destroy()
    // BleManager is a singleton for the app lifecycle; destroying it kills the native adapter.
  }

  private notifyStateChange(update: BLEStateUpdate): void {
    this._status = update.status;
    try {
      const store = useAppStore.getState();
      store.setBleStatus(update.status);
      if (update.deviceName !== undefined) store.setBleDeviceName(update.deviceName);
      if (update.deviceId !== undefined) store.setBleDeviceId(update.deviceId);
      if (update.sensorData !== undefined) {
        store.setBleSensorData(update.sensorData);
        if (update.sensorData) {
          store.setLastBleSensorData(update.sensorData);
        }
      }
      if (update.error !== undefined) store.setBleError(update.error);
    } catch {
      // Store may not be initialized in non-app contexts
    }

    for (const listener of this.listeners) {
      try {
        listener(update);
      } catch (err) {
        console.warn('Error in BLE listener:', err);
      }
    }
  }

  private handleDeviceFound(device: Device): void {
    if (this.foundDevice) return;
    this.foundDevice = device;
    this.scanner.stop();
    void this.connectToDevice();
  }

  private handleSensorData(data: BLESensorData): void {
    this.lastRealSensorData = data;
    this._status = 'connected';
    this.notifyStateChange({
      status: 'connected',
      sensorData: data,
      deviceName: this.connection.connectedDeviceName,
      deviceId: this.connection.connectedDeviceId,
    });
  }

  private handleDisconnect(): void {
    this._status = 'disconnected';
    this.foundDevice = null;
    this.notifyStateChange({ status: 'disconnected' });
  }

  private handleError(error: string): void {
    this._status = 'error';
    this.notifyStateChange({ status: 'error', error });
  }
}

export const bluetoothManager = BluetoothManager.getInstance();
