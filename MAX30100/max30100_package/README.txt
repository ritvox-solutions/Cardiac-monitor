MAX30100 Basic (Heart Rate + SpO2) — Package Contents & Install Guide
=======================================================================

WHAT'S IN THIS ZIP
-------------------
1. MAX30100_Basic/
   Your sketch (MAX30100_Basic.ino), ready to open in Arduino IDE.

2. libraries/MAX30100lib/
   The only external dependency: "Arduino-MAX30100" by OXullo Intersecans
   (provides MAX30100_PulseOximeter.h). In Arduino IDE's Library Manager
   this shows up as "MAX30100lib".

   NOTE: Wire.h is NOT included — it ships built into the ESP32 board core.
   You just need the ESP32 board package installed (step 1 below); no
   OLED library is needed for this sketch since it only prints to Serial.

HOW TO INSTALL (Arduino IDE)
-----------------------------
1. Install ESP32 board support (skip if already done):
   File > Preferences > "Additional Board Manager URLs" > add:
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   Then Tools > Board > Boards Manager > search "esp32" > Install
   (for XIAO ESP32 boards, pick the matching XIAO_ESP32C3/S3/C6 entry
   under Tools > Board once installed)

2. Copy the "MAX30100lib" folder from this zip's "libraries" folder into
   your Arduino libraries directory:
   - Windows: Documents\Arduino\libraries\
   - macOS:   ~/Documents/Arduino/libraries/
   - Linux:   ~/Arduino/libraries/
   Restart Arduino IDE if it was already open.

3. Open the sketch: MAX30100_Basic/MAX30100_Basic.ino

4. Select your board (Tools > Board) and correct serial port, then Upload.

VERIFY LIBRARY INSTALLED CORRECTLY
-------------------------------------
Sketch > Include Library — you should see "MAX30100lib" (or
"Arduino-MAX30100") listed.

WIRING REMINDER
------------------
Your sketch hardcodes Wire.begin(21, 22) — that's the standard ESP32
devkit I2C pin layout, NOT the Seeed XIAO board's D4/D5 I2C pins
discussed earlier. If you're using a XIAO ESP32 board:
  (a) rewire so your I2C lines land on GPIO21 (SDA) / GPIO22 (SCL) if
      those pins are broken out on your specific XIAO variant, or
  (b) change the line to Wire.begin(); to use the board's default I2C
      pins (D4/D5), or Wire.begin(SDA_PIN, SCL_PIN) with your board's
      actual I2C GPIOs.

NOTE ON THIS SKETCH
----------------------
This version only reads heart rate + SpO2 and prints them to Serial —
it does not include the OLED display or the dosha scoring logic from
your other MAX30102 sketch. Let me know if you want those merged in
here too.
