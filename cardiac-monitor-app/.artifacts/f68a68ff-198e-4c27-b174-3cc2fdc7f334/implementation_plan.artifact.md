# Replace Live Data with Continuous Mock Data in React Native App

The objective is to temporarily replace all live sensor data with realistic, gradually changing dummy data. We will implement a `MockSensorService` that updates the application state every second and provide a single toggle to switch back to live data.

## User Review Required

> [!IMPORTANT]
> This change will bypass all live Bluetooth and Backend API calls for sensor data, predictions, and DCSI when the `USE_MOCK_DATA` flag is set to `true`.
> The `LiveMonitoring` screen interval will be increased in frequency to show per-second updates.

## Proposed Changes

### [Component] Mock Service

#### [NEW] [mockSensorService.ts](file:///C:/projects/smart-watch/cardiac-monitor-app/src/services/mock/mockSensorService.ts)
- Create a `MockSensorService` class that maintains current state for:
  - Heart Rate (68–95 BPM, gradual changes)
  - SpO₂ (96–100%, gradual changes)
  - Temperature (36.2–37.2 °C, gradual changes)
  - Battery (70–100%, slow decrease)
  - Risk Level/Score/Confidence/DCSI (randomized within specified ranges)
- Implement a `start()` method that uses `setInterval` (1s) to update the Zustand store (`useAppStore`).
- Implement methods to generate historical data for the History screen.

---

### [Component] Configuration

#### [MODIFY] [constants/index.ts](file:///C:/projects/smart-watch/cardiac-monitor-app/src/constants/index.ts)
- Add `export const USE_MOCK_DATA = true;`

---

### [Component] API Integration

#### [MODIFY] [services/api/index.ts](file:///C:/projects/smart-watch/cardiac-monitor-app/src/services/api/index.ts)
- Conditionally export functions from `mockSensorService` or `api` based on `USE_MOCK_DATA`.
- For example, `getLatestSensorData` will return the current state from `MockSensorService` if mocking is enabled.

---

### [Component] Store & App Initialization

#### [MODIFY] [App.tsx](file:///C:/projects/smart-watch/cardiac-monitor-app/App.tsx)
- Use a `useEffect` at the root to call `MockSensorService.start()` if `USE_MOCK_DATA` is true.

---

### [Component] Screens

#### [MODIFY] [screens/LiveMonitoring/index.tsx](file:///C:/projects/smart-watch/cardiac-monitor-app/src/screens/LiveMonitoring/index.tsx)
- Adjust the monitoring interval to 1 second if `USE_MOCK_DATA` is true to reflect the real-time mock data.
- Ensure the UI displays the additional mock fields (Temperature, Battery) if applicable.

## Verification Plan

### Manual Verification
- Launch the app with `USE_MOCK_DATA = true`.
- Navigate to **Live Monitoring** and verify values update every second and change gradually (no large jumps).
- Navigate to **Dashboard** and verify Risk Level and DCSI are displayed.
- Navigate to **Prediction** and verify mock prediction data is shown.
- Navigate to **History** and verify charts are populated with mock data.
- Toggle `USE_MOCK_DATA = false` and verify the app reverts to standard API/mock calls (without the 1s background updates).
