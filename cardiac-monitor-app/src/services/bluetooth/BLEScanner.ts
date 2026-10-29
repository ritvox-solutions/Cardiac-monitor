import { BleManager, Device } from 'react-native-ble-plx';

const SENSOR_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const ESP32_NAME_PREFIX = 'ESP32';
const SCAN_TIMEOUT_MS = 20000;

export class BLEScanner {
  private manager: BleManager;
  private onDeviceFound: (device: Device) => void;
  private onError: (error: string) => void;
  private isScanning: boolean;
  private timeoutId: ReturnType<typeof setTimeout> | null;
  private seenNames: Set<string>;

  constructor(
    manager: BleManager,
    onDeviceFound: (device: Device) => void,
    onError: (error: string) => void,
  ) {
    this.manager = manager;
    this.onDeviceFound = onDeviceFound;
    this.onError = onError;
    this.isScanning = false;
    this.timeoutId = null;
    this.seenNames = new Set();
  }

  get scanning(): boolean {
    return this.isScanning;
  }

  async start(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;
    this.seenNames.clear();

    try {
      await this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          this.stop();
          const msg = error.message ?? '';
          if (!/cancel|destroy/i.test(msg)) {
            this.onError(msg);
          }
          return;
        }
        if (!device) return;

        const label = device.name ?? device.localName;
        if (label) this.seenNames.add(label);

        if (this.isTargetDevice(device)) {
          this.onDeviceFound(device);
        }
      });

      // Without this the scan spins forever when nothing matches.
      this.timeoutId = setTimeout(() => {
        if (!this.isScanning) return;
        this.stop();
        const seen = this.seenNames.size
          ? ` Devices seen: ${Array.from(this.seenNames).slice(0, 6).join(', ')}.`
          : ' No BLE devices seen at all.';
        this.onError(
          `No ESP32 watch found after ${SCAN_TIMEOUT_MS / 1000}s. Check that it is ` +
            `powered and its screen/serial shows "Advertising", and that Location ` +
            `is turned on (Android needs it for BLE scans).${seen}`,
        );
      }, SCAN_TIMEOUT_MS);
    } catch (error) {
      this.isScanning = false;
      const msg = error instanceof Error ? error.message : 'Scan failed';
      if (!/cancel|destroy/i.test(msg)) {
        this.onError(msg);
      }
    }
  }

  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (!this.isScanning) return;
    try {
      this.manager.stopDeviceScan();
    } catch {
      // safe ignore if manager stopped
    }
    this.isScanning = false;
  }

  private isTargetDevice(device: Device): boolean {
    const name = device.name ?? device.localName ?? '';
    if (name.startsWith(ESP32_NAME_PREFIX)) return true;

    // Fallback: the firmware advertises the sensor service UUID in its scan
    // response, so match on that even if the name is missing from the packet.
    const uuids = device.serviceUUIDs ?? [];
    return uuids.some((u) => u.toLowerCase() === SENSOR_SERVICE_UUID);
  }
}
