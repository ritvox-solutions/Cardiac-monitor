#include <Wire.h>
#include "MAX30100_PulseOximeter.h"

#define REPORTING_PERIOD_MS 1000

PulseOximeter pox;

uint32_t tsLastReport = 0;

// Callback when a pulse is detected
void onBeatDetected() {
    Serial.println("💓 Beat detected!");
}

void setup() {
    Serial.begin(115200);
    Serial.println("Initializing MAX30100...");

    // I2C pins for ESP32: SDA=21, SCL=22 (default)
    Wire.begin(21, 22);

    if (!pox.begin()) {
        Serial.println("ERROR: Failed to initialize MAX30100. Check wiring!");
        while (true); // Halt
    }

    // Set IR LED current (options: 7.6mA to 50mA)
    pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);

    // Register beat callback
    pox.setOnBeatDetectedCallback(onBeatDetected);

    Serial.println("MAX30100 initialized successfully!");
}

void loop() {
    // Update sensor readings
    pox.update();

    // Report every 1 second
    if (millis() - tsLastReport > REPORTING_PERIOD_MS) {
        float heartRate = pox.getHeartRate();
        uint8_t spo2    = pox.getSpO2();

        Serial.print("Heart Rate: ");
        Serial.print(heartRate);
        Serial.print(" bpm  |  SpO2: ");
        Serial.print(spo2);
        Serial.println(" %");

        tsLastReport = millis();
    }
}