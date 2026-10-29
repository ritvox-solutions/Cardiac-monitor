import { BleManager, Device } from 'react-native-ble-plx';
import { parseSensorPayload } from './BLEParser';
import type { BLESensorData } from '../../types';

const SENSOR_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const SENSOR_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

function normalizeUUID(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

function matchesUUID(target: string, actual: string): boolean {
  const tNorm = normalizeUUID(target);
  const aNorm = normalizeUUID(actual);
  return tNorm === aNorm || aNorm.includes(tNorm.slice(4, 8)) || tNorm.includes(aNorm);
}

function decodeBase64(base64: string): string {
  if (typeof atob === 'function') {
    try {
      return atob(base64);
    } catch {
      // fallback
    }
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  let i = 0;
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < clean.length) {
    const enc1 = chars.indexOf(clean.charAt(i++));
    const enc2 = chars.indexOf(clean.charAt(i++));
    const enc3 = chars.indexOf(clean.charAt(i++));
    const enc4 = chars.indexOf(clean.charAt(i++));
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    str += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) str += String.fromCharCode(chr2);
    if (enc4 !== 64 && enc4 !== -1) str += String.fromCharCode(chr3);
  }
  return str;
}

export class BLEConnection {
  private manager: BleManager;
  private device: Device | null;
  private onData: (data: BLESensorData) => void;
  private onDisconnect: () => void;
  private onError: (error: string) => void;
  private reconnectAttempts: number;
  private shouldReconnect: boolean;
  private monitoredCharacteristic: string | null;

  constructor(
    manager: BleManager,
    onData: (data: BLESensorData) => void,
    onDisconnect: () => void,
    onError: (error: string) => void,
  ) {
    this.manager = manager;
    this.device = null;
    this.onData = onData;
    this.onDisconnect = onDisconnect;
    this.onError = onError;
    this.reconnectAttempts = 0;
    this.shouldReconnect = false;
    this.monitoredCharacteristic = null;
  }

  get isConnected(): boolean {
    return this.device !== null;
  }

  get connectedDeviceId(): string | null {
    return this.device?.id ?? null;
  }

  get connectedDeviceName(): string | null {
    return this.device?.name ?? this.device?.localName ?? null;
  }

  async connect(targetDevice: Device): Promise<void> {
    this.shouldReconnect = true;
    await this.teardown();

    try {
      // Connect to GATT server
      const connected = await targetDevice.connect({ requestMTU: 185, timeout: 15000 });
      this.device = connected;

      // Small settle before service discovery — Android GATT needs a moment to initialize
      await new Promise((r) => setTimeout(r, 400));
      await connected.discoverAllServicesAndCharacteristics();

      let subscribed = false;
      const services = await connected.services();

      for (const service of services) {
        try {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (matchesUUID(SENSOR_CHARACTERISTIC_UUID, char.uuid)) {
              this.monitoredCharacteristic = char.uuid;
              char.monitor((error, updatedChar) => {
                if (error) {
                  const msg = error.message ?? '';
                  if (!/cancel|disconnect|destroy/i.test(msg)) this.onError(msg);
                  return;
                }
                if (updatedChar?.value) {
                  const payloadStr = decodeBase64(updatedChar.value);
                  const parsed = parseSensorPayload(payloadStr);
                  if (parsed) this.onData(parsed);
                }
              });
              subscribed = true;
              break;
            }
          }
        } catch {
          // Ignore service read error and try next
        }
        if (subscribed) break;
      }

      // Fallback: direct subscription if service loop missed it
      if (!subscribed) {
        try {
          connected.monitorCharacteristicForService(
            SENSOR_SERVICE_UUID,
            SENSOR_CHARACTERISTIC_UUID,
            (error, updatedChar) => {
              if (error) {
                const msg = error.message ?? '';
                if (!/cancel|disconnect|destroy/i.test(msg)) this.onError(msg);
                return;
              }
              if (updatedChar?.value) {
                const payloadStr = decodeBase64(updatedChar.value);
                const parsed = parseSensorPayload(payloadStr);
                if (parsed) this.onData(parsed);
              }
            },
          );
          this.monitoredCharacteristic = SENSOR_CHARACTERISTIC_UUID;
          subscribed = true;
        } catch {
          // Ignore fallback error
        }
      }

      if (!subscribed) {
        await this.teardown();
        const errMessage = 'Watch connected but the sensor service was not found — check firmware UUIDs.';
        this.onError(errMessage);
        throw new Error(errMessage);
      }

      connected.onDisconnected(() => {
        const lost = this.device;
        this.device = null;
        this.monitoredCharacteristic = null;
        this.onDisconnect();
        if (this.shouldReconnect && lost) this.attemptReconnect(lost);
      });

      this.reconnectAttempts = 0;
    } catch (error) {
      await this.teardown();
      const message = error instanceof Error ? error.message : 'Connection failed';
      this.onError(message);
      throw error;
    }
  }

  private async teardown(): Promise<void> {
    const d = this.device;
    this.device = null;
    this.monitoredCharacteristic = null;
    if (d) {
      try {
        await d.cancelConnection();
      } catch {
        // already disconnected
      }
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    await this.teardown();
  }

  private async attemptReconnect(lost: Device): Promise<void> {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.shouldReconnect = false;
      this.onError('Lost connection to the watch. Tap Connect to try again.');
      return;
    }

    this.reconnectAttempts++;
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    if (!this.shouldReconnect) return;

    try {
      await this.connect(lost);
    } catch {
      this.attemptReconnect(lost);
    }
  }
}
