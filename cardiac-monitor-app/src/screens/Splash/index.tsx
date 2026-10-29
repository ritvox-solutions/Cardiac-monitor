import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/useAppStore';
import { AppLogo, GradientView } from '../../components/common';
import { Colors, FontSize, FontWeight, Spacing } from '../../theme';

const SplashScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const done = useRef(false);

  useEffect(() => {
    // The persisted session (user/token/isAuthenticated) is rehydrated from
    // AsyncStorage asynchronously by the zustand `persist` middleware. Until
    // that finishes, useAppStore.getState() still holds the store's initial
    // (logged-out) defaults, so navigating before hydration completes would
    // always bounce straight to Auth/Onboarding regardless of the real
    // session — wait for it explicitly instead of reading state immediately.
    const navigateFromState = () => {
      if (done.current) return;
      done.current = true;
      const { isAuthenticated, user } = useAppStore.getState();
      const destination = !isAuthenticated
        ? 'Auth'
        : user?.healthProfile
          ? 'MainTabs'
          : 'Onboarding';
      (navigation as any).replace(destination);
    };

    if (useAppStore.persist.hasHydrated()) {
      navigateFromState();
      return;
    }

    const unsubscribe = useAppStore.persist.onFinishHydration(navigateFromState);
    return unsubscribe;
  }, []);

  return (
    <GradientView
      colors={[Colors.primaryDark, Colors.primary]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <AppLogo size={96} containerStyle={styles.icon} withGlow />
      <Text style={styles.title}>Cardiac Monitor</Text>
      <Text style={styles.subtitle}>Wearable Health Intelligence</Text>
      <Text style={styles.version}>v1.0.0</Text>
    </GradientView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.onPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: FontWeight.medium,
  },
  version: {
    position: 'absolute',
    bottom: Spacing.xxl,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: FontWeight.medium,
  },
});

export default SplashScreen;
