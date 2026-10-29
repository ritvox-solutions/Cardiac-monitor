# Mock Sensor Data Integration Walkthrough

I have implemented a mock sensor data system for both the React Native and Flutter versions of the application. This allows for development and testing without requiring a physical ESP32 wearable.

## Changes Summary

### [React Native App]

1.  **[NEW] [mockSensorService.ts](file:///C:/projects/smart-watch/cardiac-monitor-app/src/services/mock/mockSensorService.ts)**
    - Generates realistic, gradually changing sensor values (Heart Rate, SpO2, Temperature, Battery).
    - Updates the global Zustand store every 60 seconds.
    - Provides mock predictions and DCSI scores.

2.  **[MODIFY] [constants/index.ts](file:///C:/projects/smart-watch/cardiac-monitor-app/src/constants/index.ts)**
    - Added `USE_MOCK_DATA = true` flag for easy toggling.

3.  **[MODIFY] [App.tsx](file:///C:/projects/smart-watch/cardiac-monitor-app/App.tsx)**
    - Initializes the `mockSensorService` on app startup.

4.  **[MODIFY] API Services**
    - `sensor.ts`, `prediction.ts`, and `dcsi.ts` now consume the state from `mockSensorService` when mocking is enabled.

5.  **[MODIFY] [LiveMonitoring](file:///C:/projects/smart-watch/cardiac-monitor-app/src/screens/LiveMonitoring/index.tsx)**
    - Reduced refresh frequency to once per minute to match the data source.

### [Flutter App]

1.  **[NEW] [mock_sensor_service.dart](file:///C:/projects/smart-watch/cardiac_monitor_app/lib/core/services/mock/mock_sensor_service.dart)**
    - Dart implementation of the mock generator with smooth value transitions.

2.  **[MODIFY] [health_repository.dart](file:///C:/projects/smart-watch/cardiac_monitor_app/lib/core/repositories/health_repository.dart)**
    - Refactored to switch between `BluetoothService` and `MockSensorService` based on a configuration flag.

3.  **[MODIFY] [app_config.dart](file:///C:/projects/smart-watch/cardiac_monitor_app/lib/core/config/app_config.dart)**
    - Added `useMockData` configuration (defaults to `true`).

## Verification Results

- **Data Realism:** Heart rate and SpO2 values now change by small increments (gradual) rather than jumping randomly.
- **Update Frequency:** Verified that updates now occur every **60 seconds**, significantly reducing UI "noise".
- **Switchability:** The original Bluetooth implementation is preserved; simply set `USE_MOCK_DATA` to `false` to revert.

> [!TIP]
> You can see the "Mock Reading Generated" logs in your console to verify the 1-minute interval is working.
