import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import HealthProfileForm from '../../components/forms/HealthProfileForm';
import { Colors, Spacing, FontSize } from '../../theme';
import type { HealthProfile } from '../../types';

interface HealthProfileScreenProps {
  navigation: any;
}

const HealthProfileScreen: React.FC<HealthProfileScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { updateHealthProfile, loading, error } = useAuth();

  const handleSubmit = async (profile: HealthProfile) => {
    const ok = await updateHealthProfile(profile);
    if (ok) {
      navigation.goBack();
    }
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'‹ Back'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Health Profile</Text>
        <Text style={styles.subtitle}>
          Used alongside your live heart rate and SpO₂ readings to produce an accurate cardiac
          risk prediction.
        </Text>

        <HealthProfileForm
          onSubmit={handleSubmit}
          submitLabel="Save Health Profile"
          loading={loading}
          error={error}
        />
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
  backButton: {
    marginBottom: Spacing.sm,
  },
  backButtonText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
});

export default HealthProfileScreen;
