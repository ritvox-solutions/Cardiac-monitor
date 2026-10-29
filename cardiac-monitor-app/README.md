# Cardiac Risk Monitoring App

A React Native mobile app that connects to the FastAPI backend, collects heart rate and SpO₂ data, computes Daily Cardiac Stress Index (DCSI), and sends emergency alerts.

## Prerequisites

- Node.js (v18+)
- npm (or yarn)
- Watchman
- Expo CLI (`npm i -g expo-cli`)
- Android Studio (for Android) or Xcode (for iOS)
- CocoaPods (`sudo gem install cocoapods`)

## Android Setup

### 1. Install Android Studio

Download and install Android Studio from https://developer.android.com/studio.

During installation, ensure the following components are selected:
- Android SDK
- Android SDK Platform
- Android Virtual Device (AVD)
- Intel HAXM or Android Emulator Hypervisor Driver (for AMD)

### 2. Install Required SDK Components

Open Android Studio → Settings → Languages & Frameworks → Android SDK:

**SDK Platforms tab:**
- Android 13 (Tiramisu) - API Level 33
- Android 14 (Upside Down Cake) - API Level 34

**SDK Tools tab:**
- Android SDK Build-Tools 34
- Android SDK Command-line Tools
- Android SDK Platform-Tools
- Android Emulator
- Intel x86 Emulator Accelerator (HAXM installer) or Android Emulator Hypervisor Driver

### 3. Configure Environment Variables (Windows)

Set the following environment variables:

```
ANDROID_HOME = C:\Users\<YourUsername>\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT = C:\Users\<YourUsername>\AppData\Local\Android\Sdk
```

Add to PATH:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
```

### 4. Configure Environment Variables (macOS/Linux)

Add to `~/.bashrc` or `~/.zshrc`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

### 5. Install Java JDK 17

React Native requires JDK 17. Download from https://adoptium.net/ or use:
```bash
# Windows (using Chocolatey)
choco install temurin17

# macOS (using Homebrew)
brew install --cask temurin@17
```

### 6. Create Android Virtual Device (AVD)

1. Open Android Studio → Tools → Device Manager
2. Click "Create Device"
3. Select a device (e.g., Pixel 6)
4. Select system image (e.g., API 33, x86_64)
5. Configure AVD settings and click "Finish"

### 7. Verify Installation

```bash
adb --version
sdkmanager --version
```

### 8. Expo Dependencies

```bash
expo install expo-modules-core
expo install expo-device
expo install expo-constants
```

## iOS Setup

### 1. Install Xcode

Download and install Xcode from the Mac App Store (requires macOS).

### 2. Install Command-Line Tools

```bash
xcode-select --install
```

### 3. Install CocoaPods

```bash
sudo gem install cocoapods
```

### 4. Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### 5. Configure iOS Simulator

1. Open Xcode → Window → Devices and Simulators
2. Click "+" to add a new simulator
3. Select device and iOS version
4. Click "Create"

### 6. Verify Installation

```bash
xcodebuild -version
pod --version
```

## Additional Dependencies

### Watchman (Recommended)

Watchman watches files and triggers actions when they change.

```bash
# Windows (using Chocolatey)
choco install watchman

# macOS (using Homebrew)
brew install watchman
```

### Git

Ensure Git is installed for version control:
```bash
git --version
```

## Installation

```bash
git clone <repo-url>
cd cardiac-monitor-app
npm install
# For iOS
cd ios && pod install && cd ..
```

## Environment Variables

Copy the example file and edit the values:

```bash
cp .env.example .env
# Edit .env with your backend URL, e.g. API_BASE_URL=http://localhost:8000
```

## Running the App

```bash
npm start        # starts Expo dev server
# In the Expo client, scan the QR code or press 'i' for iOS simulator / 'a' for Android emulator
```

## Building for Device

```bash
# iOS
npm run ios      # builds and launches on iOS simulator
# Android
npm run android  # builds and launches on Android emulator/device
```

## Linting & Formatting

```bash
npm run lint      # runs ESLint
npm run format    # runs Prettier
```

## Testing

```bash
npm test
```

## Contributing

Feel free to open issues or submit pull requests. Follow the code style (PEP8 for Python backend, Airbnb for React Native).

## License

MIT License.