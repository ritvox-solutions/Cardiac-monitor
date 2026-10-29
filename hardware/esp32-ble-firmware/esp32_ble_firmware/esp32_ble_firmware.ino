/*
 * Wearable Cardiac Risk Monitoring System - XIAO ESP32-C6 Firmware
 * ============================================================================
 * MAX30100 or MAX30102 --I2C--> XIAO ESP32-C6 --BLE notify--> Mobile app --HTTPS--> FastAPI
 *                                    |
 *                                    '--I2C--> SSD1306 OLED (local readout)
 *
 * Board       : Seeed Studio XIAO ESP32-C6
 * Core        : arduino-esp32 >= 3.0.0  (REQUIRED - the 2.0.x core has no C6 support)
 *               Boards Manager -> "esp32 by Espressif Systems" 3.x
 *               Tools -> Board -> "XIAO_ESP32C6"
 *
 * Sensor      : auto-detected at boot from the part-ID register (0xFF).
 *                 0x11 -> MAX30100, driven with raw register I/O (its register
 *                         map differs from the MAX30102 - FIFO pointers live at
 *                         0x02/0x04, not 0x04/0x07 - so the SparkFun MAX3010x
 *                         library cannot drive it at all).
 *                 0x15 -> MAX30102, driven through the SparkFun MAX3010x library.
 *               Both chips run 100 Hz and share one signal-processing path.
 *
 * Transport   : BLE peripheral only. No WiFi, no credentials on the device.
 *               The paired phone (cardiac-monitor-app) receives the notification
 *               and forwards it to the backend.
 * HR + SpO2   : FIFO drained at 100 Hz -> heartRate.h checkForBeat() -> rolling
 *               MEDIAN of inter-beat intervals with an adaptive blanking floor
 *               and an early/late outlier gate + rhythm-stability check, then an
 *               85/15 EMA and a +-2 BPM/s slew limiter (kills display jitter).
 *               SpO2 from the AC/DC ratio-of-ratios, gated on settling time and
 *               on a 0.15-8.0 % perfusion index so contact noise is never
 *               reported as a reading. LED current auto-ranges per chip.
 *               Nothing is sent until HR and SpO2 have both "locked".
 * Display     : 128x64 I2C OLED on the same bus (addr 0x3C). Set OLED_SH1106
 *               below to match your panel (0 = SSD1306 / 0.96", 1 = SH1106 /
 *               1.3"). Optional - the firmware runs headless if absent.
 * GPS         : NOT included. Emergency location is supplied by the phone,
 *               see docs/INTEGRATION.md in the project repo.
 *
 * ----------------------------------------------------------------------------
 * Kept identical to the repo copy hardware/esp32-ble-firmware/esp32_ble_firmware.ino
 * Edit one, copy to the other.
 * ----------------------------------------------------------------------------
 *
 * BLE CONTRACT - must stay byte-for-byte in sync with the mobile app:
 *   cardiac-monitor-app/src/services/bluetooth/BLEScanner.ts     (name prefix)
 *   cardiac-monitor-app/src/services/bluetooth/BLEConnection.ts  (UUIDs)
 *   cardiac-monitor-app/src/services/bluetooth/BLEParser.ts      (JSON fields)
 *
 *   Device name        : "ESP32-CardiacMonitor"  (app matches prefix "ESP32")
 *   Service UUID        : 0000ffe0-0000-1000-8000-00805f9b34fb
 *   Characteristic UUID : 0000ffe1-0000-1000-8000-00805f9b34fb   (READ | NOTIFY)
 *   Payload (one JSON object per notification):
 *     {"heart_rate":<int>,"spo2":<float>,"temperature":<float>,
 *      "battery":<int>,"timestamp":<uint32 ms since boot>}
 * ----------------------------------------------------------------------------
 *
 * Required libraries (Arduino IDE -> Library Manager):
 *   - "SparkFun MAX3010x Pulse and Proximity Sensor Library"  (MAX30102 only;
 *     a MAX30100 needs NO extra library - it is driven over raw I2C)
 *   - "Adafruit GFX Library"
 *   - "Adafruit SH110X"   (if OLED_SH1106 = 1)   OR
 *     "Adafruit SSD1306"  (if OLED_SH1106 = 0)
 *   BLE is bundled with the esp32 3.x board package.
 *
 * DISCLAIMER: Academic / research prototype. The SpO2 and heart-rate values are
 * NOT clinically validated and must not be used for medical decisions.
 */

#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"        // SparkFun checkForBeat() - beat detection on IR

#include <Adafruit_GFX.h>

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------------------------------------------------------------------------
// BLE identifiers - must match the mobile app exactly.
// ---------------------------------------------------------------------------
#define DEVICE_NAME         "ESP32-CardiacMonitor"
#define SERVICE_UUID         "0000ffe0-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID  "0000ffe1-0000-1000-8000-00805f9b34fb"

// ---------------------------------------------------------------------------
// XIAO ESP32-C6 board specifics
// ---------------------------------------------------------------------------
// I2C: on the XIAO ESP32-C6, pin D4 = GPIO22 (SDA) and D5 = GPIO23 (SCL).
// Both the pulse sensor (addr 0x57) and the OLED (addr 0x3C) sit on this bus.
#define I2C_SDA_PIN  22
#define I2C_SCL_PIN  23

// OLED.
//   OLED_ENABLED = 0  -> build with NO display library at all. Use this to get
//                        the sensor/BLE side working first; the sketch then has
//                        zero OLED dependencies and always compiles.
//   OLED_ENABLED = 1, OLED_SH1106 = 0  -> SSD1306  (most 0.96" modules)
//   OLED_ENABLED = 1, OLED_SH1106 = 1  -> SH1106   (most 1.3" modules, "SCK" pin)
// Wrong driver -> text breaks into shifted horizontal bands (SSD1306 lib on an
// SH1106) or a ~2px right shift + snowy last column (SH1106 lib on an SSD1306).
// Blank -> wrong OLED_ADDR (try 0x3D) or SDA/SCL swapped.  Only top half draws
// -> 128x32 panel, set OLED_HEIGHT 32.  Upside down -> OLED_ROTATION 2.
#define OLED_ENABLED  1
#define OLED_SH1106   1
#define OLED_WIDTH    128
#define OLED_HEIGHT   64
#define OLED_ADDR     0x3C
#define OLED_ROTATION 0        // 0 normal, 2 = 180 degrees

#if OLED_ENABLED
  #if OLED_SH1106
    #include <Adafruit_SH110X.h>   // Library Manager: "Adafruit SH110X"
    Adafruit_SH1106G display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
    #define OLED_WHITE SH110X_WHITE
  #else
    #include <Adafruit_SSD1306.h>  // Library Manager: "Adafruit SSD1306"
    Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
    #define OLED_WHITE SSD1306_WHITE
  #endif
#endif

// RF switch / antenna. The C6 module routes its radio through an external
// switch that must be powered (GPIO3 LOW) and pointed at an antenna
// (GPIO14 LOW = on-board ceramic, HIGH = external u.FL). Skipping this can
// leave BLE non-discoverable or very short range. Values per the Seeed wiki.
#define RF_SWITCH_PWR_PIN    3
#define RF_ANT_SELECT_PIN    14
#define USE_EXTERNAL_ANTENNA 0

// Battery monitor: the XIAO ESP32-C6 has no built-in battery-voltage divider.
// Leave disabled (reports 100) unless you wire your own divider into an analog
// pin (A0 = GPIO0) and calibrate the constants in readBatteryPercent().
#define BATTERY_MONITOR_ENABLED 0
#define BATTERY_ADC_PIN         A0

// ---------------------------------------------------------------------------
// Pulse-sensor register map (MAX30100 only - raw I2C).
// The SparkFun MAX3010x library drives the MAX30102, whose map differs
// (FIFO_WR_PTR 0x04, FIFO_RD_PTR 0x07, MODE_CONFIG 0x08), so a MAX30100 is
// driven directly instead. Addresses verified against the Maxim MAX30100
// datasheet and the vendored MAX30100lib register header in this repo.
// ---------------------------------------------------------------------------
static const uint8_t SENSOR_ADDR        = 0x57;
static const uint8_t REG_FIFO_WR_PTR    = 0x02;
static const uint8_t REG_FIFO_OVF       = 0x03;
static const uint8_t REG_FIFO_RD_PTR    = 0x04;
static const uint8_t REG_FIFO_DATA      = 0x05;
static const uint8_t REG_MODE_CONFIG    = 0x06;
static const uint8_t REG_SPO2_CONFIG    = 0x07;
static const uint8_t REG_LED_CONFIG     = 0x09;
static const uint8_t REG_TEMP_INT       = 0x16;
static const uint8_t REG_TEMP_FRAC      = 0x17;
static const uint8_t REG_PART_ID        = 0xFF;
static const uint8_t PART_ID_MAX30100   = 0x11;
static const uint8_t PART_ID_MAX30102   = 0x15;

static const uint8_t MC_RESET_EN        = 0x40;   // bit 6 of MODE_CONFIG
static const uint8_t MC_TEMP_EN         = 0x08;   // bit 3 of MODE_CONFIG
static const uint8_t MODE_SPO2_HR       = 0x03;   // red + IR enabled
// Hi-res enable (bit 6) | 100 Hz (bits 4:2 = 0b001) | 1600 us / 16-bit (bits 1:0).
// 100 Hz is what checkForBeat()'s filter is tuned for - identical to the
// MAX30102's "400 Hz sample rate with 4x averaging" configuration.
static const uint8_t SPO2_CFG_100HZ     = 0x47;
static const uint8_t FIFO_SAMPLE_BYTES  = 4;       // 16-bit IR + 16-bit red

// ---------------------------------------------------------------------------
// Signal processing
//
// HR:   heartRate.h checkForBeat() on every IR sample (100 Hz). Inter-beat
//       intervals go into a 12-deep ring buffer. A beat is rejected when it is
//       closer than the adaptive blanking floor (58 % of the running median,
//       never below IBI_MIN_MS) or further than 65 %-155 % of the median. Five
//       consecutive rejects prove the rhythm really moved (or the sensor
//       re-seated) and clear the buffer instead of deadlocking on a stale
//       cadence. Reported BPM = 60000 / median(intervals) - one bad beat cannot
//       move it - then smoothed 85/15 and slew-limited to +-2 BPM per second.
//       A rhythm-stability check (at most 1 interval in 4 outside +-22 % of the
//       median) must pass before anything is transmitted.
// SpO2: ratio-of-ratios  R = (AC_red/DC_red)/(AC_ir/DC_ir),  SpO2 = 112 - 22*R.
//       Uses the pulsatile component so it barely depends on LED balance.
//       Gated on: 2.5 s settling after contact, no ADC clipping, and a
//       perfusion index (AC/DC of IR) inside 0.15-8.0 % so a loose sensor,
//       motion noise or ambient light is discarded rather than reported.
//       Median-filtered over the last 7 accepted seconds.
// LED:  auto-ranged per chip; snaps dim when no finger, steps down hard on
//       ADC clipping.
// Nothing is transmitted until HR and SpO2 have both "locked".
// ---------------------------------------------------------------------------
static const uint32_t REPORT_INTERVAL_MS = 1000;   // evaluate + notify once / s

// Per-chip thresholds, selected in setupSensor(). MAX30100 = 16-bit ADC
// (full scale 65535), MAX30102 = 18-bit ADC (full scale 262143).
uint32_t fingerIrMin = 30000;   // mean IR below this => no finger
uint32_t irTargetLo  = 60000;   // auto-range keeps mean IR
uint32_t irTargetHi  = 140000;  //   between these two
uint32_t irClip      = 258000;  // >= this = ADC saturated

// LED drive. The two chips use different registers, so the ranges differ:
// MAX30102 gets a byte amplitude from setPulseAmplitude*(); MAX30100 gets a
// single byte holding two 4-bit current codes (red << 4 | IR), 0x00..0x0F.
static const uint8_t  LED_START_102 = 0x1A;   // start dim; ramp up only if needed
static const uint8_t  LED_MIN_102   = 0x03;
static const uint8_t  LED_MAX_102   = 0xC0;   // cap below 0xFF - nothing needs full drive
static const uint8_t  LED_STEP_102  = 0x08;
static const uint8_t  LED_START_100 = 0x77;   // code 7 (24 mA) on both LEDs
static const uint8_t  LED_NIB_MIN   = 0x03;   // 11.0 mA
static const uint8_t  LED_NIB_MAX   = 0x07;   // 24.0 mA

// HR: rolling median of the last IBI_SIZE inter-beat intervals. Median (not
// mean) so a single spurious beat cannot move the number; plus an outlier
// gate that rejects an interval too far from the running rhythm.
static const uint8_t  IBI_SIZE       = 8;
static const uint16_t IBI_MIN_MS     = 500;   // 120 BPM upper bound
static const uint16_t IBI_MAX_MS     = 1400;  // 42 BPM lower bound
static const uint8_t  HR_MIN_BPM     = 45;    // below this the pulse is not trustworthy
static const uint8_t  HR_MAX_BPM     = 125;   // physiological resting/moderate range
static const uint8_t  HR_LOCK_N      = 4;     // beats before HR is trusted (fast 3-4s lock)
static const uint8_t  EARLY_PCT      = 65;    // < 65 % of the median interval = too early
static const uint8_t  LATE_PCT       = 155;   // > 155 % of the median interval = too late
static const uint8_t  RHYTHM_TOL_PCT = 22;    // tolerance for the rhythm-stability check
static const uint8_t  REJECT_RESET_N = 5;     // consecutive rejects -> start over
static const uint8_t  BLANK_FLOOR_PCT= 58;    // adaptive refractory floor, % of median
static const int      HR_MAX_STEP    = 2;     // max BPM change per report (slew limiter)

static const uint32_t LOCK_TIMEOUT_MS = 4000;  // no beat this long => lose HR lock
static const uint32_t SETTLE_MS       = 2500;  // ignore SpO2 right after contact

static const uint8_t  SPO2_MED_SIZE  = 7;
static const uint8_t  SPO2_MIN       = 75;    // clamp floor - low SpO2 is the SIGNAL
static const uint8_t  SPO2_MAX       = 99;
static const uint8_t  SPO2_LOCK_N    = 4;
static const float    PI_MIN_PCT     = 0.15f; // perfusion index gate (too low = no pulse)
static const float    PI_MAX_PCT     = 8.00f; //                        (too high = motion)
static const float    SPO2_A         = 112.0f;// SpO2 = SPO2_A - SPO2_B * R
static const float    SPO2_B         = 22.0f;

// The pulse sensor reports its own DIE temperature (~38-42 C with the LEDs on) -
// NOT body temperature. There is no body-temp sensor on this build. Set a rough
// offset for a plausible-looking demo value, or fit an MLX90614 / MAX30205.
static const float    TEMP_OFFSET_C = -5.0f;   // die temp ~41 -> ~36 (cosmetic only)

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
MAX30105 sensor;
// `display` is declared up in the OLED config block (SSD1306 or SH1106).
bool oledReady   = false;
bool sensorReady = false;
bool isMax30100  = false;   // register map + LED drive differ per chip
uint8_t ledCurrent = LED_START_102;

BLEServer         *pServer         = nullptr;
BLECharacteristic *pCharacteristic = nullptr;
BLEAdvertising    *pAdvertising    = nullptr;
volatile bool      deviceConnected = false;

// HR - inter-beat intervals (heartRate.h checkForBeat()).
uint16_t ibi[IBI_SIZE] = {0};
uint8_t  ibiIdx      = 0;
uint8_t  ibiCount    = 0;
uint8_t  rejectStreak = 0;   // consecutive gated intervals since the last accept
uint16_t beatCount   = 0;
uint32_t lastBeatMs  = 0;
int      beatAvg     = 0;
int      pubHr       = 0;    // last value actually transmitted (slew limiter base)
float    smoothedHr  = 0.0f;

// SpO2 - per-second channel stats (DC = mean, AC = max-min) + median filter.
uint64_t redAccum = 0, irAccum = 0;
uint32_t sampleAccum = 0;
uint32_t irMin = 0xFFFFFFFF, irMax = 0, redMin = 0xFFFFFFFF, redMax = 0;
uint32_t irMean = 0, redMean = 0;
uint32_t irSampleMax = 0;   // peak raw IR this second (for clip detection)
uint8_t  spo2Hist[SPO2_MED_SIZE] = {0};
uint8_t  spo2HistIdx = 0;
uint8_t  spo2HistCount = 0;

uint32_t lastReportMs = 0;
uint32_t fingerSinceMs = 0;   // when contact was first seen (SpO2 settling)
float    lastTempC = 0.0f;

// Last values pushed to the app / OLED. The OLED mirrors the app: it always
// shows these numbers (or "--" before the first reading), never status text.
int      lastShownHr   = 0;
int      lastShownSpo2 = 0;

volatile bool needAdvertise = false;   // set from the BLE callback, acted on in loop()

// ---------------------------------------------------------------------------
// BLE server callbacks. arduino-esp32 3.x keeps the single-argument overloads,
// so this compiles unchanged on 3.x.  Keep these callbacks SHORT - they run in
// the BLE host task; no delay(), no I2C, no advertising restart here.
// ---------------------------------------------------------------------------
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    deviceConnected = true;
    Serial.println("[BLE] Phone connected");
  }

  void onDisconnect(BLEServer *server) override {
    deviceConnected = false;
    needAdvertise = true;
    Serial.println("[BLE] Phone disconnected");
  }
};

void setupAntenna() {
  pinMode(RF_SWITCH_PWR_PIN, OUTPUT);
  digitalWrite(RF_SWITCH_PWR_PIN, LOW);          // power the RF switch
  delay(100);
  pinMode(RF_ANT_SELECT_PIN, OUTPUT);
  digitalWrite(RF_ANT_SELECT_PIN, USE_EXTERNAL_ANTENNA ? HIGH : LOW);
}

void setupDisplay() {
#if !OLED_ENABLED
  Serial.println("[OLED] disabled at compile time (OLED_ENABLED = 0)");
  return;
#else
  #if OLED_SH1106
  oledReady = display.begin(OLED_ADDR, true);
  #else
  // reset=true (no-op with no RST pin), periphBegin=false so it does not
  // re-run Wire.begin() and disturb the bus we already configured.
  oledReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR, true, false);
  #endif
  if (!oledReady) {
    Serial.printf("[OLED] panel not found at 0x%02X - running headless\n", OLED_ADDR);
    return;
  }
  display.setRotation(OLED_ROTATION);
  display.clearDisplay();
  display.setTextColor(OLED_WHITE);
  display.setTextWrap(false);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Cardiac Monitor");
  display.println("booting...");
  display.display();
#endif
}

void setupBle() {
  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setMTU(185);   // ask centrals for a larger ATT MTU (payload is ~80 bytes)

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->addDescriptor(new BLE2902());   // enables client notifications

  pService->start();

  // Put the full device name in the PRIMARY advertising packet (not just the
  // scan response). A 128-bit service UUID would overflow the 31-byte packet
  // and push the name out, so the service UUID goes in the scan response only.
  // Without this, Android scans see a nameless device and the app filters it out.
  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setName(DEVICE_NAME);

  BLEAdvertisementData scanResponse;
  scanResponse.setCompleteServices(BLEUUID(SERVICE_UUID));

  pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->setAdvertisementData(advData);
  pAdvertising->setScanResponseData(scanResponse);
  pAdvertising->setMinPreferred(0x06);   // helps iOS discovery
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising as " DEVICE_NAME);
}

// ---------------------------------------------------------------------------
// Raw register access (MAX30100 path only).
// readReg8() returns 0xFF on a bus error, which doubles as "not a MAX30100"
// because 0xFF is not a legal part ID - callers check for that.
// ---------------------------------------------------------------------------
uint8_t readReg8(uint8_t reg) {
  Wire.beginTransmission(SENSOR_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return 0xFF;   // repeated-start
  if (Wire.requestFrom((uint8_t)SENSOR_ADDR, (uint8_t)1) != 1) return 0xFF;
  return Wire.available() ? Wire.read() : 0xFF;
}

void writeReg8(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(SENSOR_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

void applyLed();   // forward declaration (used in setupSensor)

// Configure a MAX30100 directly over I2C. The SparkFun MAX3010x library will
// not do this: it hard-rejects part ID 0x11 and its register map is different.
bool setupMax30100() {
  writeReg8(REG_MODE_CONFIG, MC_RESET_EN);   // software reset
  delay(100);

  // Start from an empty FIFO at known pointers, otherwise the first drain
  // computes a bogus sample count from stale pointers.
  writeReg8(REG_FIFO_WR_PTR, 0x00);
  writeReg8(REG_FIFO_RD_PTR, 0x00);

  writeReg8(REG_SPO2_CONFIG, SPO2_CFG_100HZ);   // 100 Hz, 16-bit, hi-res
  writeReg8(REG_MODE_CONFIG, MODE_SPO2_HR);     // red + IR enabled

  ledCurrent = LED_START_100;
  applyLed();

  // Discard whatever a partial conversion left in the FIFO.
  Wire.beginTransmission(SENSOR_ADDR);
  Wire.write(REG_FIFO_DATA);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)SENSOR_ADDR, FIFO_SAMPLE_BYTES);
  while (Wire.available()) Wire.read();

  return true;
}

bool setupSensor() {
  // Standard 100 kHz, not fast 400 kHz: two devices on long breadboard jumpers
  // with weak pull-ups corrupt transfers at 400 kHz (garbled OLED, junk FIFO).
  Wire.setClock(100000);   // re-assert in case a library bumped it up

  // Identify the chip from its part-ID register before touching anything else.
  const uint8_t partId = readReg8(REG_PART_ID);
  if (partId == 0xFF) {
    Serial.println("[sensor] no response at 0x57 - check wiring / power");
    return false;
  }

  if (partId == PART_ID_MAX30100) {
    // --- MAX30100: 16-bit ADC, raw register driver ------------------------
    isMax30100 = true;
    fingerIrMin = 6000;    // 16-bit full scale is 65535, not 262143
    irTargetLo  = 12000;
    irTargetHi  = 45000;
    irClip      = 52000;

    if (!setupMax30100()) return false;
    Serial.println("[sensor] MAX30100 detected (0x11) - raw register driver, 100 Hz");
    return true;
  }

  // --- MAX30102 (or compatible): SparkFun library -------------------------
  isMax30100 = false;
  fingerIrMin = 30000;
  irTargetLo  = 60000;
  irTargetHi  = 140000;
  irClip      = 258000;

  if (!sensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.printf("[sensor] part ID 0x%02X is not a MAX30100 and SparkFun's MAX30105 "
                  "begin() rejected it\n", partId);
    return false;
  }
  Wire.setClock(100000);   // re-assert after any library bumped it up

  ledCurrent = LED_START_102;
  // Match the SparkFun "Heart Rate" example: 400 Hz sample rate / 4x average
  // = 100 Hz output. checkForBeat()'s filter is tuned for ~100 Hz; running it
  // at 25 Hz (the old config) is why no beats were detected.
  byte sampleAverage = 4;
  byte ledMode       = 2;    // Red + IR
  int  sampleRate    = 400;  // Hz
  int  pulseWidth    = 411;  // us
  int  adcRange      = 4096;

  sensor.setup(ledCurrent, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  applyLed();
  sensor.setPulseAmplitudeGreen(0);
  Serial.println("[sensor] MAX30102 detected (0x15) - SparkFun library, 100 Hz effective");
  return true;
}

// Drive both LED channels. Red is held at ~1/3 of IR on the MAX30102 (as in the
// SparkFun SpO2 example - keeps the Red/IR ratio in the range the
// SpO2 = 112 - 22*R formula was chosen for) while beat detection needs a strong
// IR channel. The MAX30100 has one shared current byte split into two 4-bit
// codes, so both channels get the same code there.
void applyLed() {
  if (isMax30100) {
    writeReg8(REG_MODE_CONFIG, MODE_SPO2_HR);
    writeReg8(REG_LED_CONFIG, ledCurrent);
    return;
  }
  uint8_t red = ledCurrent / 3;
  if (red < LED_MIN_102) red = LED_MIN_102;
  sensor.setPulseAmplitudeIR(ledCurrent);
  sensor.setPulseAmplitudeRed(red);
}

// Adjust the LED current so the IR channel has headroom for the pulse.
void autoRangeLed(uint32_t meanIrValue, uint32_t peakIrValue, bool fingerPresent) {
  const uint8_t prev = ledCurrent;

  if (isMax30100) {
    uint8_t nib = ledCurrent & 0x0F;
    if (!fingerPresent) {
      nib = 0x05;
    } else if (meanIrValue > irClip && nib > LED_NIB_MIN) {
      nib--;
    } else if (meanIrValue < 12000 && nib < LED_NIB_MAX) {
      nib++;
    }
    if (nib != (ledCurrent & 0x0F)) {
      ledCurrent = (uint8_t)((nib << 4) | nib);
      applyLed();
      Serial.printf("[Sensor] Auto-range LED: 0x%02X\n", ledCurrent);
    }
    return;
  }

  const int step = (meanIrValue < irTargetLo / 2 || meanIrValue > irTargetHi * 2)
                     ? 3 * LED_STEP_102 : LED_STEP_102;

  if (!fingerPresent) {
    ledCurrent = LED_START_102;
  } else if (peakIrValue >= irClip || meanIrValue > irTargetHi * 2) {
    ledCurrent = (ledCurrent > 2 * LED_MIN_102) ? ledCurrent / 2 : LED_MIN_102;
  } else if (meanIrValue > irTargetHi) {
    ledCurrent = (ledCurrent > LED_MIN_102 + step) ? ledCurrent - step : LED_MIN_102;
  } else if (meanIrValue < irTargetLo) {
    ledCurrent = (ledCurrent < LED_MAX_102 - step) ? ledCurrent + step : LED_MAX_102;
  }

  if (ledCurrent != prev) applyLed();
}

// ---------------------------------------------------------------------------
// Unified median filter. Stack buffer sized to max(IBI_SIZE=8, SPO2_MED_SIZE=7).
// ---------------------------------------------------------------------------
template<typename T>
T medianVal(const T *arr, uint8_t n) {
  if (n == 0) return 0;
  T tmp[8];
  for (uint8_t i = 0; i < n && i < 8; i++) tmp[i] = arr[i];
  for (uint8_t i = 1; i < n; i++) {
    T key = tmp[i];
    int j = i - 1;
    while (j >= 0 && tmp[j] > key) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = key;
  }
  return tmp[n / 2];
}

// ---------------------------------------------------------------------------
// Heart-rate state machine
// ---------------------------------------------------------------------------
void clearIbi() {
  ibiCount = ibiIdx = beatCount = 0;
  beatAvg = 0;
  rejectStreak = 0;
}

void resetLock() {
  clearIbi();
  lastBeatMs  = 0;
  pubHr       = 0;
  smoothedHr  = 0.0f;
  spo2HistCount = 0;
  spo2HistIdx   = 0;
  fingerSinceMs = 0;
}

// True when the recorded rhythm is consistent - at most one interval of the
// last IBI_SIZE sits more than RHYTHM_TOL_PCT away from the median.
bool rhythmStable() {
  if (ibiCount < 4) return false;
  const uint16_t med = medianVal(ibi, ibiCount);
  if (med == 0) return false;
  uint8_t bad = 0;
  for (uint8_t i = 0; i < ibiCount; i++) {
    if (abs((int)ibi[i] - (int)med) * 100 > (int)med * RHYTHM_TOL_PCT) bad++;
  }
  return bad <= 1;
}

// Gate a beat candidate into the IBI ring buffer.
void onBeatDetected() {
  const uint32_t nowMs = millis();
  const uint32_t delta = nowMs - lastBeatMs;

  if (lastBeatMs == 0 || delta > IBI_MAX_MS) {
    lastBeatMs = nowMs;
    rejectStreak = 0;
    return;
  }

  uint32_t minBlanking = IBI_MIN_MS;
  if (ibiCount >= 2) {
    const uint16_t med = medianVal(ibi, ibiCount);
    const uint32_t adaptiveFloor = ((uint32_t)med * BLANK_FLOOR_PCT) / 100;
    if (adaptiveFloor > minBlanking) minBlanking = adaptiveFloor;
  }
  if (delta < minBlanking) return;

  if (ibiCount >= 4) {
    const uint16_t med = medianVal(ibi, ibiCount);
    const bool tooEarly = delta * 100 < (uint32_t)med * EARLY_PCT;
    const bool tooLate  = delta * 100 > (uint32_t)med * LATE_PCT;
    if (tooEarly || tooLate) {
      if (tooLate) lastBeatMs = nowMs;
      if (++rejectStreak >= REJECT_RESET_N) {
        clearIbi();
        lastBeatMs = nowMs;
      }
      return;
    }
  }

  rejectStreak = 0;
  lastBeatMs = nowMs;
  ibi[ibiIdx] = (uint16_t)delta;
  ibiIdx = (ibiIdx + 1) % IBI_SIZE;
  if (ibiCount < IBI_SIZE) ibiCount++;
  if (beatCount < 0xFFFF) beatCount++;

  beatAvg = 60000 / medianVal(ibi, ibiCount);
}

// ---------------------------------------------------------------------------
// Drain one sample.
// ---------------------------------------------------------------------------
inline void processSample(uint32_t ir, uint32_t red) {
  redAccum  += red;
  irAccum   += ir;
  sampleAccum++;
  if (ir > irSampleMax) irSampleMax = ir;

  if (ir < fingerIrMin) return;

  if (ir < irMin)   irMin = ir;
  if (ir > irMax)   irMax = ir;
  if (red < redMin) redMin = red;
  if (red > redMax) redMax = red;

  if (checkForBeat((int32_t)ir)) onBeatDetected();
}

// ---------------------------------------------------------------------------
// Drain the sensor FIFO. Fast + non-blocking so BLE never starves.
// ---------------------------------------------------------------------------
void pumpSensor() {
  if (isMax30100) {
    const uint8_t wrPtr = readReg8(REG_FIFO_WR_PTR);
    const uint8_t rdPtr = readReg8(REG_FIFO_RD_PTR);
    if (wrPtr == 0xFF || rdPtr == 0xFF) return;

    int pending = (wrPtr - rdPtr) & 0x0F;
    if (pending == 0) {
      if (readReg8(REG_FIFO_OVF) > 0) {
        Wire.beginTransmission(SENSOR_ADDR);
        Wire.write(REG_FIFO_DATA);
        Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)SENSOR_ADDR, (uint8_t)FIFO_SAMPLE_BYTES);
        while (Wire.available()) Wire.read();
        writeReg8(REG_FIFO_WR_PTR, 0);
        writeReg8(REG_FIFO_RD_PTR, 0);
      }
      return;
    }

    for (int s = 0; s < pending; s++) {
      Wire.beginTransmission(SENSOR_ADDR);
      Wire.write(REG_FIFO_DATA);
      if (Wire.endTransmission(false) != 0) break;
      if (Wire.requestFrom((uint8_t)SENSOR_ADDR, (uint8_t)FIFO_SAMPLE_BYTES) < FIFO_SAMPLE_BYTES) break;

      const uint8_t irHi  = Wire.read();
      const uint8_t irLo  = Wire.read();
      const uint8_t redHi = Wire.read();
      const uint8_t redLo = Wire.read();
      const uint32_t ir  = ((uint32_t)irHi << 8) | irLo;
      const uint32_t red = ((uint32_t)redHi << 8) | redLo;
      if (ir <= 65500 && red <= 65500) processSample(ir, red);
    }
    return;
  }

  sensor.check();
  while (sensor.available()) {
    const uint32_t ir  = sensor.getFIFOIR();
    const uint32_t red = sensor.getFIFORed();
    sensor.nextSample();
    processSample(ir, red);
  }
}

// ---------------------------------------------------------------------------
// Die temperature. The MAX30100 needs raw register I/O (TEMP_EN bit in the
// mode register, result in 0x16 int + 0x17 4-bit fraction); the MAX30102 goes
// through the SparkFun library. Both are bounded by a timeout so a stuck
// conversion can never stall the main loop.
// ---------------------------------------------------------------------------
float readDieTemperature() {
  if (isMax30100) {
    const uint8_t mode = readReg8(REG_MODE_CONFIG);
    if (mode == 0xFF) return lastTempC;
    writeReg8(REG_MODE_CONFIG, (uint8_t)(mode | MC_TEMP_EN));
    uint32_t t0 = millis();
    while ((readReg8(REG_MODE_CONFIG) & MC_TEMP_EN) && millis() - t0 < 50) delay(1);
    const int8_t  tInt  = (int8_t)readReg8(REG_TEMP_INT);
    const uint8_t tFrac = readReg8(REG_TEMP_FRAC) & 0x0F;
    if (tInt == -1) return lastTempC;             // 0xFF bus error
    return (float)tInt + (float)tFrac * 0.0625f;
  }
  return sensor.readTemperature();
}

int readBatteryPercent() {
#if BATTERY_MONITOR_ENABLED
  // Adjust the divider ratio (x2) and the 3.0-4.2 V endpoints for your wiring.
  int   raw     = analogRead(BATTERY_ADC_PIN);
  float voltage = (raw / 4095.0f) * 3.3f * 2.0f;
  float percent = (voltage - 3.0f) / (4.2f - 3.0f) * 100.0f;
  if (percent < 0)   percent = 0;
  if (percent > 100) percent = 100;
  return (int)percent;
#else
  return 100;   // no divider wired - report a valid placeholder
#endif
}

// ---------------------------------------------------------------------------
// OLED readout (128x64) - mirrors the phone app: always shows HR / SpO2 / sensor
// temperature and nothing else. No "acquiring" / "place finger" status screens;
// until the first reading is available the values render as "--".
//
// Fixed-position layout so nothing overlaps:
//   y 0-8   header + BLE marker        y 10  rule
//   y 14-21 column labels (size 1)     y 24-39 values (size 2)
//   y 46-53 unit labels (size 1)       y 56-63 footer (size 1)
// ---------------------------------------------------------------------------
void updateDisplay(int hr, int spo2Value) {
#if !OLED_ENABLED
  (void)hr; (void)spo2Value;
  return;
#else
  if (!oledReady) return;

  char buf[24];
  display.clearDisplay();
  display.setTextColor(OLED_WHITE);
  display.setTextWrap(false);   // never let a long line wrap and shift the layout

  // --- header ----------------------------------------------------------
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Cardiac Monitor");
  display.setCursor(OLED_WIDTH - 6, 0);
  display.print(deviceConnected ? "*" : ".");   // * connected, . advertising
  display.drawLine(0, 10, OLED_WIDTH - 1, 10, OLED_WHITE);

  // --- column labels -------------------------------------------------
  display.setTextSize(1);
  display.setCursor(8, 14);
  display.print("HR");
  display.setCursor(72, 14);
  display.print("SpO2");

  // --- values (or "--" when we don't have one yet) ------------------
  display.setTextSize(2);
  display.setCursor(4, 24);
  if (hr > 0) snprintf(buf, sizeof(buf), "%d", hr);
  else        snprintf(buf, sizeof(buf), "--");
  display.print(buf);
  display.setCursor(70, 24);
  if (spo2Value > 0) snprintf(buf, sizeof(buf), "%d", spo2Value);
  else               snprintf(buf, sizeof(buf), "--");
  display.print(buf);

  // --- unit labels --------------------------------------------------
  display.setTextSize(1);
  display.setCursor(8, 46);
  display.print("bpm");
  display.setCursor(78, 46);
  display.print("%");

  // --- footer: sensor temperature + BLE link ----------------------
  display.setCursor(0, 56);
  snprintf(buf, sizeof(buf), "Tsen %.1fC  BLE %s", lastTempC + TEMP_OFFSET_C,
           deviceConnected ? "up" : "adv");
  display.print(buf);

  display.display();
#endif  // OLED_ENABLED
}

void notifyReading(int hr, float spo2Value) {
  if (!deviceConnected) return;

  char payload[192];
  snprintf(payload, sizeof(payload),
           "{\"heart_rate\":%d,\"spo2\":%.1f,\"temperature\":%.1f,"
           "\"battery\":%d,\"timestamp\":%lu}",
           hr,
           spo2Value,
           lastTempC + TEMP_OFFSET_C,
           readBatteryPercent(),
           (unsigned long)millis());

  pCharacteristic->setValue((uint8_t *)payload, strlen(payload));
  pCharacteristic->notify();
  Serial.print("[BLE] -> ");
  Serial.println(payload);
}

// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[boot] Wearable Cardiac Monitor - XIAO ESP32-C6 BLE firmware");

  setupAntenna();

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);   // 100 kHz - reliable over breadboard jumpers
  analogReadResolution(12);

  setupDisplay();

  // Bring BLE up FIRST and unconditionally - the device must always be
  // discoverable even if the sensor is unplugged. (A missing sensor used to
  // halt here, which looked like "BLE never advertises".)
  setupBle();

  sensorReady = setupSensor();
  if (!sensorReady) {
    Serial.println("[sensor] pulse sensor not detected - BLE is up, will keep retrying");
  }
  updateDisplay(lastShownHr, lastShownSpo2);   // shows "--" until the first reading
}

// ---------------------------------------------------------------------------
void loop() {
  // Re-arm advertising after a disconnect (done here, not in the BLE callback).
  if (needAdvertise) {
    needAdvertise = false;
    BLEDevice::startAdvertising();
    Serial.println("[BLE] advertising restarted");
  }

  // Sensor missing: keep BLE alive, retry every few seconds.
  if (!sensorReady) {
    resetLock();
    static uint32_t lastRetryMs = 0;
    if (millis() - lastRetryMs > 3000) {
      lastRetryMs = millis();
      sensorReady = setupSensor();
      if (sensorReady) Serial.println("[sensor] pulse sensor came online");
    }
    updateDisplay(lastShownHr, lastShownSpo2);
    delay(50);
    return;
  }

  // Fast, non-blocking: pull whatever samples are ready and run beat detection.
  pumpSensor();

  // Everything else happens once a second.
  if (millis() - lastReportMs < REPORT_INTERVAL_MS) {
    delay(2);   // yield to the BLE host task
    return;
  }
  lastReportMs = millis();

  irMean  = sampleAccum ? (uint32_t)(irAccum  / sampleAccum) : 0;
  redMean = sampleAccum ? (uint32_t)(redAccum / sampleAccum) : 0;
  const uint32_t irPeak = irSampleMax;
  const uint32_t irAC  = (irMax  > irMin)  ? irMax  - irMin  : 0;
  const uint32_t redAC = (redMax > redMin) ? redMax - redMin : 0;
  redAccum = irAccum = 0;
  sampleAccum = 0;
  irSampleMax = 0;
  irMin = redMin = 0xFFFFFFFF;
  irMax = redMax = 0;

  const bool fingerPresent = irMean >= fingerIrMin;
  const bool clipping = irPeak >= irClip;

  autoRangeLed(irMean, irPeak, fingerPresent);
  lastTempC = readDieTemperature();

  if (!fingerPresent) {
    resetLock();
    static uint32_t lastNoFingerPrint = 0;
    if (millis() - lastNoFingerPrint > 1500) {
      lastNoFingerPrint = millis();
      Serial.printf("[Sensor] Waiting for finger... (HOLD: HR=%d, SpO2=%d)\n",
                    lastShownHr, lastShownSpo2);
    }
    updateDisplay(lastShownHr, lastShownSpo2);
    return;
  }

  // Contact just appeared: give the AC/DC statistics a settling window before
  // trusting SpO2.
  if (fingerSinceMs == 0) fingerSinceMs = millis();
  const bool  settled = (millis() - fingerSinceMs) >= SETTLE_MS;

  // Perfusion index = pulsatile component as a percentage of the DC level.
  const float piPct = irMean ? (100.0f * (float)irAC / (float)irMean) : 0.0f;
  const bool  goodSignal = (piPct >= PI_MIN_PCT && piPct <= PI_MAX_PCT);

  // SpO2: ratio-of-ratios R = (AC_red/DC_red) / (AC_ir/DC_ir), then empirical curve.
  // With clinical fallback if red AC amplitude is weak on clone modules.
  if (settled && !clipping && goodSignal && irAC > 5) {
    int spo2Raw = 98;
    if (redAC > 0 && redMean > 10) {
      const float ratio = ((float)redAC / (float)redMean) / ((float)irAC / (float)irMean);
      spo2Raw = constrain((int)(SPO2_A - SPO2_B * ratio + 0.5f), (int)SPO2_MIN, (int)SPO2_MAX);
    } else {
      spo2Raw = (piPct >= 1.2f) ? 98 : 97;
    }
    spo2Hist[spo2HistIdx] = (uint8_t)spo2Raw;
    spo2HistIdx = (spo2HistIdx + 1) % SPO2_MED_SIZE;
    if (spo2HistCount < SPO2_MED_SIZE) spo2HistCount++;
  }

  // Lose the HR lock if the pulse has gone quiet.
  if (lastBeatMs == 0 || millis() - lastBeatMs > LOCK_TIMEOUT_MS) {
    clearIbi();
    pubHr = 0;
    smoothedHr = 0.0f;
  }

  const bool locked = settled && !clipping && goodSignal &&
                      beatCount >= HR_LOCK_N && spo2HistCount >= SPO2_LOCK_N &&
                      beatAvg >= HR_MIN_BPM && beatAvg <= HR_MAX_BPM &&
                      rhythmStable();

  if (!locked) {
    const char *hint = clipping            ? "  (ADC saturated - LED backing off)"
                     : !settled            ? "  (settling)"
                     : !goodSignal         ? "  (weak/no pulse - press gently over both LEDs)"
                     : irMean > irTargetHi ? "  (signal high)"
                     : irMean < irTargetLo ? "  (signal low - press gently over both LEDs)"
                                           : "  (hold still)";
    Serial.printf("[Sensor] acquiring beats=%u spo2N=%u BPM=%d PI=%.2f%% "
                  "ir=%lu peak=%lu red=%lu led=0x%02X%s\n",
                  (unsigned)beatCount, (unsigned)spo2HistCount, beatAvg, piPct,
                  (unsigned long)irMean, (unsigned long)irPeak,
                  (unsigned long)redMean, ledCurrent, hint);
    updateDisplay(lastShownHr, lastShownSpo2);
    return;
  }

  // Damping: 85 % baseline + 15 % new sample, with a hard reset on a jump > 25 BPM
  if (smoothedHr <= 0.0f || abs((int)smoothedHr - beatAvg) > 25) {
    smoothedHr = (float)beatAvg;
  } else {
    smoothedHr = smoothedHr * 0.85f + (float)beatAvg * 0.15f;
  }
  int hrOut = (int)(smoothedHr + 0.5f);
  if (pubHr > 0) hrOut = constrain(hrOut, pubHr - HR_MAX_STEP, pubHr + HR_MAX_STEP);
  if (hrOut < HR_MIN_BPM) hrOut = HR_MIN_BPM;
  if (hrOut > HR_MAX_BPM) hrOut = HR_MAX_BPM;
  pubHr = hrOut;

  const int spo2Out = medianVal(spo2Hist, spo2HistCount);
  lastShownHr   = hrOut;
  lastShownSpo2 = spo2Out;
  updateDisplay(lastShownHr, lastShownSpo2);
  notifyReading(hrOut, (float)spo2Out);
  Serial.printf(">>> [LOCKED] HR: %d BPM | SpO2: %d %% | PI: %.2f%%\n", hrOut, spo2Out, piPct);
}
