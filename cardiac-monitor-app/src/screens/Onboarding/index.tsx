import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../hooks/useAuth';
import { useBluetooth } from '../../hooks/useBluetooth';
import HealthProfileForm from '../../components/forms/HealthProfileForm';
import { GradientView } from '../../components/common';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../theme';
import type { HealthProfile } from '../../types';

interface OnboardingScreenProps {
  navigation: any;
}

type OnboardingStep = 'profile' | 'bluetooth';

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { updateHealthProfile, loading, error } = useAuth();
  const { requestPermissions } = useBluetooth();
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [permissionState, setPermissionState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [requesting, setRequesting] = useState(false);

  const handleProfileSubmit = async (profile: HealthProfile) => {
    const ok = await updateHealthProfile(profile);
    if (ok) {
      setStep('bluetooth');
    }
  };

  const handleGrantPermission = async () => {
    setRequesting(true);
    try {
      const granted = await requestPermissions();
      setPermissionState(granted ? 'granted' : 'denied');
    } finally {
      setRequesting(false);
    }
  };

  const handleFinish = () => {
    navigation.replace('MainTabs');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepIndicatorWrap}>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepDot, step === 'bluetooth' && styles.stepDotActive]} />
          </View>
          <Text style={styles.stepLabel}>{step === 'profile' ? 'Step 1 of 2' : 'Step 2 of 2'}</Text>
        </View>

        {step === 'profile' ? (
          <>
            <Text style={styles.title}>Tell us about you</Text>
            <Text style={styles.subtitle}>
              This is combined with your live heart rate and SpO₂ readings to produce an
              accurate cardiac risk prediction. You can update it later from Settings.
            </Text>

            <HealthProfileForm
              onSubmit={handleProfileSubmit}
              submitLabel="Continue"
              loading={loading}
              error={error}
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>Connect your watch</Text>
            <Text style={styles.subtitle}>
              The app needs Bluetooth (and, on Android, Location) permission to discover and
              receive live heart rate and SpO₂ readings from your watch.
            </Text>

            <GradientView
              colors={permissionState === 'granted' ? [Colors.accent, '#047857'] : [Colors.primaryDark, Colors.primary]}
              style={styles.iconCircle}
            >
              <MaterialCommunityIcons name="bluetooth" size={44} color={Colors.onPrimary} />
            </GradientView>

            {permissionState === 'granted' && (
              <View style={styles.statusBannerSuccess}>
                <MaterialCommunityIcons name="check-circle" size={18} color={Colors.accent} />
                <Text style={styles.statusTextSuccess}>Bluetooth permission granted</Text>
              </View>
            )}

            {permissionState === 'denied' && (
              <View style={styles.statusBannerError}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.destructive} />
                <Text style={styles.statusTextError}>
                  Permission denied. You can grant it later from your phone's Settings app before
                  connecting to your watch.
                </Text>
              </View>
            )}

            {permissionState !== 'granted' && (
              <TouchableOpacity
                style={[styles.button, requesting && styles.buttonDisabled]}
                onPress={handleGrantPermission}
                disabled={requesting}
              >
                <Text style={styles.buttonText}>
                  {requesting ? 'Requesting...' : 'Grant Bluetooth Permission'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.secondaryButton} onPress={handleFinish}>
              <Text style={styles.secondaryButtonText}>
                {permissionState === 'granted' ? 'Get Started' : 'Skip for now'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  stepIndicatorWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: Spacing.lg,
  },
  statusBannerSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentContainer,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  statusTextSuccess: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  statusBannerError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.destructiveContainer,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  statusTextError: {
    color: Colors.destructive,
    fontSize: FontSize.sm,
    flex: 1,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadow.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.onPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default OnboardingScreen;
