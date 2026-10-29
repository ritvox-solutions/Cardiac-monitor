import { NativeModules, PermissionsAndroid, Platform, Linking } from 'react-native';

interface SmsNativeModule {
  sendSms(phoneNumber: string, message: string): Promise<boolean>;
  openSmsApp(phoneNumber: string, message: string): Promise<boolean>;
}

const smsModule = NativeModules.SmsModule as SmsNativeModule | undefined;

/** Checks if SEND_SMS permission is currently granted by the user. */
export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
  } catch {
    return false;
  }
}

/** Explicitly prompts the user for SEND_SMS runtime permission. */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'Emergency SMS Permission',
        message:
          'Cardiac Monitor needs permission to automatically send SMS emergency alerts with your GPS location to your emergency contacts when critical cardiac risk is detected.',
        buttonPositive: 'Grant Permission',
        buttonNegative: 'Cancel',
      },
    );
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('Failed to request SMS permission:', error);
    return false;
  }
}

/** Opens Android application settings so the user can toggle permissions manually if blocked. */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    console.warn('Could not open settings:', err);
  }
}

/** Opens the device's native messaging app with pre-filled recipient and text. */
export async function openNativeSmsApp(phoneNumber: string, message: string): Promise<void> {
  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
  if (smsModule?.openSmsApp) {
    try {
      await smsModule.openSmsApp(cleanNumber, message);
      return;
    } catch {
      // Fall back to Linking
    }
  }
  const url = `sms:${cleanNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
  }
}

/** Requests Android SMS permission and sends one SIM-based SMS. */
export async function sendAutomaticSms(phoneNumber: string, message: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('Automatic SIM SMS is supported on Android only.');
  }

  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
  if (cleanNumber.length < 5) {
    throw new Error(`The phone number '${phoneNumber}' is invalid.`);
  }

  // Prevent sending to default mock dummy numbers
  if (cleanNumber.includes('5550124') || cleanNumber.includes('5550125') || cleanNumber.startsWith('+1555')) {
    throw new Error(
      `'${phoneNumber}' is a dummy test number. Please set a REAL mobile number in Settings or Emergency Contacts so the SIM carrier can deliver it.`,
    );
  }

  if (!smsModule) {
    throw new Error('SMS native module is unavailable. Build the Android app.');
  }

  const isGranted = await checkSmsPermission();
  if (!isGranted) {
    const granted = await requestSmsPermission();
    if (!granted) {
      throw new Error(
        'SMS permission is required to send emergency alerts. Please enable SMS in your phone Settings -> Apps -> Cardiac Monitor -> Permissions.',
      );
    }
  }

  try {
    await smsModule.sendSms(cleanNumber, message);
  } catch (error) {
    // If background cellular dispatch fails (e.g. no SMS balance or carrier block),
    // provide an actionable error message and attempt opening the native SMS app.
    console.warn('Background SMS sending failed:', error);
    try {
      await openNativeSmsApp(cleanNumber, message);
    } catch {
      // ignore secondary failure
    }
    throw new Error(
      error instanceof Error ? error.message : 'Cellular carrier failed to send SMS. Opened SMS app.',
    );
  }
}
