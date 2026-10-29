# ESP32 BLE Firmware

Reads heart rate and SpO2 from a MAX30100 or MAX30102 pulse sensor and streams
readings to the `cardiac-monitor-app` mobile app over Bluetooth Low Energy. The
app then forwards each reading to the FastAPI backend for ML-based risk
prediction.

**Sensor auto-detection.** The chip is identified at boot from the part-ID
register at `0xFF`:

| Part ID | Chip | Driver |
|---|---|---|
| `0x11` | **MAX30100** | raw register I/O in the sketch — **no library needed** |
| `0x15` | **MAX30102** | SparkFun MAX3010x library (`MAX30105.h`) |

The two chips have *different register maps* (FIFO pointers are at `0x02/0x04`
on the MAX30100 but `0x04/0x07` on the MAX30102), so the SparkFun library
hard-rejects a MAX30100 — that is why a MAX30100 previously produced no
readings at all. Both chips are driven at 100 Hz and share one
signal-processing path.

**Target board: Seeed Studio XIAO ESP32-C6.** Requires the **arduino-esp32
core 3.0.0 or newer** — the 2.0.x core has no ESP32-C6 support. Select
`Tools → Board → XIAO_ESP32C6`.

> **Sketch location.** Flash from the Arduino sketch folder
> `Documents/Arduino/samrt/samrt.ino`. `esp32_ble_firmware.ino` in this folder is
> the repo copy and must be kept identical — Arduino just requires the `.ino`
> basename to match its containing folder, hence the two names.

```
MAX30100 / MAX30102 --I2C--> XIAO ESP32-C6 --BLE notify--> Mobile App --HTTPS--> FastAPI backend
                                |
                                '--I2C--> SSD1306 OLED (local HR / SpO2 / temp readout)
```

The board does **not** talk to the backend directly — it only advertises a
BLE service and notifies a connected phone. All networking happens on the
phone side (`src/services/bluetooth/*`, `src/services/bluetooth/PredictionService.ts`).

## Wiring (XIAO ESP32-C6)

| Device       | Pin  | XIAO pin | GPIO    | I2C addr |
|--------------|------|----------|---------|----------|
| MAX3010x     | VIN  | 3V3      | —       |          |
| MAX3010x     | GND  | GND      | —       |          |
| MAX3010x     | SDA  | D4       | GPIO 22 | 0x57     |
| MAX3010x     | SCL  | D5       | GPIO 23 |          |
| MAX3010x     | INT  | not used | —       |          |
| OLED         | VCC  | 3V3      | —       |          |
| OLED         | GND  | GND      | —       |          |
| OLED         | SDA  | D4       | GPIO 22 | 0x3C     |
| OLED         | SCL / SCK | D5  | GPIO 23 |          |

Both devices share the one I2C bus; their addresses don't collide. Both are
3.3 V parts — power from the XIAO's `3V3` pin, not `5V`. The bus runs at
**100 kHz** (`Wire.setClock(100000)`), not 400 kHz — on breadboard jumpers with
two devices and weak pull-ups, 400 kHz corrupts transfers (garbled OLED, junk
FIFO reads).

### OLED driver — SSD1306 vs SH1106

Set `#define OLED_SH1106` in the sketch:

| Value | Panel | Install |
|---|---|---|
| `0` | SSD1306 (most **0.96"** modules) | "Adafruit SSD1306" |
| `1` | SH1106 (most **1.3"** modules; clock pin often labelled `SCK`) | "Adafruit SH110X" |

Wrong driver → **text breaks into shifted horizontal bands / scrambled blocks**
(SSD1306 lib on an SH1106) or a ~2 px right shift with a snowy last column
(SH1106 lib on an SSD1306). Blank screen → try `OLED_ADDR 0x3D`, or SDA/SCL are
swapped. Only the top half draws → it's a 128×32 panel, set `OLED_HEIGHT 32`.
The OLED is optional — a failed `begin()` logs `[OLED] ... running headless`.

The OLED mirrors the phone app: it always shows just **HR / SpO₂ / sensor
temperature** (with a `*` when a phone is connected, `.` when only advertising).
Before the first locked reading the numbers show as `--`; there are no
"acquiring" / "place finger" status screens on the panel (that detail still
prints on serial as `[sensor] acquiring ...`).

Keep the I2C wires **short** (10–15 cm max on a breadboard) and the modules
close to the XIAO; long jumpers next to an active BLE radio are the usual cause
of a flickering or partly-corrupt screen.

**Antenna:** the C6's radio runs through an RF switch. The firmware drives
`GPIO3 = LOW` (switch power) and `GPIO14 = LOW` (on-board ceramic antenna) in
`setupAntenna()`. Set `USE_EXTERNAL_ANTENNA` to `1` if you fit a u.FL antenna.
If BLE never appears in a scanner, this is the first thing to check.

**Battery %:** the XIAO ESP32-C6 has no built-in battery-voltage divider, so
`BATTERY_MONITOR_ENABLED` is `0` and the firmware reports a constant `100`
(the app just needs a valid number). To wire your own divider, feed it into
`A0` (GPIO0), set `BATTERY_MONITOR_ENABLED` to `1`, and calibrate the constants
in `readBatteryPercent()`.

GPS (NEO-6M) is not part of this firmware — it belongs to the separate
emergency-alert location flow, not the live HR/SpO2 monitoring path.

## Required libraries (Arduino IDE → Library Manager)

- **SparkFun MAX3010x Pulse and Proximity Sensor Library** (provides
  `MAX30105.h`, which is included unconditionally and supplies `checkForBeat()`
  from `heartRate.h` for beat detection). **Required even for a MAX30100** — the
  sketch only uses it to *drive* a MAX30102; the MAX30100 itself uses raw
  register I/O from the sketch. You do **not** need a separate MAX30100 library.
- **Adafruit GFX Library**, plus **Adafruit SH110X** (`OLED_SH1106 = 1`) *or*
  **Adafruit SSD1306** (`OLED_SH1106 = 0`) for the display. Installing
  Adafruit SSD1306 usually pulls in GFX and BusIO automatically.

> The library's bundled `spo2_algorithm.h` is **not** used — SpO₂ comes from the
> ratio-of-ratios curve described below.

BLE (`BLEDevice.h` …) ships with the `esp32` 3.x board package — no extra
library. Do **not** also install the standalone "ESP32 BLE Arduino" library;
it conflicts with the bundled one on core 3.x.

## Flashing

1. `Tools → Board → XIAO_ESP32C6` (install the esp32 3.x core first if it is
   not listed).
2. Plug in over USB-C, select the COM port. If the port does not appear, hold
   **BOOT**, tap **RESET**, release **BOOT**, then select the port.
3. Open the sketch and upload.
4. Open the Serial Monitor at 115200 baud — you should see
   `[BLE] Advertising as ESP32-CardiacMonitor`. After a ~4 s priming window with
   a fingertip on the sensor, a JSON line (`[BLE] -> {...}`) is emitted about
   once per second. Notifications are only sent while a phone is connected.

## The app never finds the watch

Work down this list — the first two are the usual cause.

1. **Serial Monitor does not print `[BLE] Advertising as ...`.**
   The firmware is not running or not radiating. Since the sensor no longer
   halts boot, this means either the sketch did not upload, or the C6 antenna
   GPIOs are wrong for your board revision — check `RF_SWITCH_PWR_PIN` /
   `RF_ANT_SELECT_PIN` against the current Seeed XIAO ESP32-C6 wiki and flip the
   levels if needed.
2. **Android: Location is off.** Android returns zero BLE scan results when the
   system Location toggle is off, even with Bluetooth and all permissions
   granted. Turn Location on.
3. **`[sensor] no response at 0x57`** on serial is fine for discovery — BLE still
   advertises. Fix the I2C wiring to get readings, but it is not why the scan
   fails.
4. **Another BLE scanner app** (nRF Connect, LightBlue) also cannot see
   `ESP32-CardiacMonitor` → firmware/antenna problem. It *can* see it but the
   app cannot → rebuild the app (BLE needs a dev client, not Expo Go) and check
   the app's scan-timeout message, which lists the device names it did see.
5. Only one phone can be connected at a time; disconnect any other.

## Matching the mobile app

These identifiers are hard-coded on both sides and must stay in sync:

| | Firmware | Mobile app |
|---|---|---|
| Device name prefix | `ESP32-CardiacMonitor` | `BLEScanner.ts` filters for names starting with `"ESP32"` |
| Service UUID | `0000ffe0-0000-1000-8000-00805f9b34fb` | `BLEConnection.ts: SENSOR_SERVICE_UUID` |
| Characteristic UUID | `0000ffe1-0000-1000-8000-00805f9b34fb` | `BLEConnection.ts: SENSOR_CHARACTERISTIC_UUID` |
| JSON fields | `heart_rate, spo2, temperature, battery, timestamp` | `BLEParser.ts: REQUIRED_FIELDS_SNAKE` |

If you change any UUID or field name on one side, update the other —
nothing enforces this at compile time.

## How a reading is produced

`loop()` is **non-blocking**: each pass drains whatever samples are waiting in
the sensor FIFO (100 Hz), runs beat detection, and yields to the BLE stack. Once
a second it evaluates and (if locked) transmits.

- **Heart rate** — `heartRate.h` `checkForBeat()` on every IR sample. Each
  inter-beat interval goes into a 12-deep ring. A beat is accepted only when it
  is longer than the **adaptive blanking floor** (58 % of the running median,
  never below 400 ms) *and* within **65 %–155 %** of that median — so dicrotic
  notches and noise spikes are blanked while a genuinely fast or slow rhythm
  still tracks. 5 consecutive rejects mean the rhythm really moved (or the
  sensor was re-seated) and the ring starts over instead of deadlocking on a
  stale cadence. Reported BPM = `60000 / median(intervals)`, then smoothed with
  an 85/15 EMA and slew-limited to ±2 BPM per second so the readout never
  flickers. A **rhythm-stability** check (at most 1 of the last 4 intervals
  outside ±22 % of the median) must pass before anything is transmitted.
  40–150 BPM — deliberately wide, because tachycardia *is* the risk being
  monitored.
- **SpO2** — ratio-of-ratios: `R = (AC_red/DC_red) / (AC_ir/DC_ir)` over the
  1-second window, `SpO2 = 112 − 22·R`, clamped to 75–99 and median-filtered
  over the last 7 accepted seconds. Uses the pulsatile component, so it barely
  depends on LED balance. **Still not clinically accurate.** Gated on:
  - **2.5 s settling** after contact is first seen (no plausible-looking but
    meaningless first readings),
  - a **perfusion index** (`AC/DC × 100` of IR) inside **0.15–8.0 %** — outside
    that range there is no reliable pulse (loose contact / ambient light) or it
    is motion artefact rather than physiology,
  - **no ADC clipping**, and a non-zero **red** channel pulse — a dead or
    clipped red LED yields `redAC == 0`, and guessing 98 % there would report
    false confidence.
  Low readings are **kept**: SpO₂ below 90 % is exactly the event this device
  exists to catch (the old firmware rejected anything under 90).
- **LED auto-ranging**, per chip — MAX30102 steps a byte amplitude, MAX30100
  steps a 4-bit current code (`0x03`–`0x07`, both channels) since its current
  register is two nibbles in one byte. Mean IR is kept inside
  `irTargetLo..irTargetHi`; snaps back to a mid level when no finger;
  **steps down immediately on ADC clipping** (no pulse possible while clipped).
  Per-chip thresholds: MAX30100 16-bit ADC → finger `6000`, target `12000..45000`,
  clip `52000`; MAX30102 18-bit ADC → finger `30000`, target `60000..140000`,
  clip `258000`.
- **Nothing is transmitted until it locks**: 2.5 s settling + `HR_LOCK_N` beats
  + `SPO2_LOCK_N` SpO2 samples + a stable rhythm, and not while clipping.
  Serial: `[sensor] acquiring beats=.. spo2N=.. BPM=.. PI=..% .. (hint)`.
- **`temperature`** is the **die** temperature, not body temp. It self-heats to
  ~41 °C with the LEDs on; `TEMP_OFFSET_C` (default −5) shifts it to a plausible
  demo value. For a real reading fit an MLX90614 / MAX30205. (Read raw for a
  MAX30100 — `TEMP_EN` in the mode register, `0x16`/`0x17` for the value —
  through `sensor.readTemperature()` for a MAX30102.)

## Getting a clean reading

Erratic numbers = poor contact, every time. Press one fingertip flat over
**both** LEDs with firm, steady pressure; keep still; wait ~10 s for the lock.
Cold hands, thick calluses, nail polish, and bright ambient light all hurt the
signal.

## Known limitations (academic prototype, not a medical device)

- **SpO2 / heart rate** are *not* clinically calibrated and are sensitive to
  motion and contact pressure. The gating above rejects obvious garbage but
  cannot make a loose sensor accurate.
- **HRV is not computed on the device.** The mobile app currently substitutes a
  constant (see `docs/INTEGRATION.md` gap #5).
- **`loop()` is non-blocking** (FIFO drained as it arrives, evaluated once a
  second), but the MAX30100 die-temperature read can block for up to 50 ms per
  report if the conversion never completes — bounded by a timeout so the BLE
  link can't stall. The C6 is single-core (RISC-V), so keep `loop()` lean: the
  main loop competes with the host BLE task.
- **Battery %** is only meaningful once the ADC divider is wired and its
  ratio matches the constants in the firmware.
