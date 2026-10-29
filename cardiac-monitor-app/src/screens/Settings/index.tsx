import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';
import { Card, ScreenHeader, AppLogo } from '../../components/common';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme';
import type { ThemeMode } from '../../types';

interface SettingsScreenProps {
  navigation: any;
}

interface SettingRowProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, label, value, right, onPress, destructive }) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={!onPress && !right}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={[styles.settingIcon, destructive && styles.settingIconDestructive]}>
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={destructive ? Colors.destructive : Colors.primary}
      />
    </View>
    <Text style={[styles.settingLabel, destructive && { color: Colors.destructive }]}>{label}</Text>
    {value && <Text style={styles.settingValue}>{value}</Text>}
    {right}
    {onPress && !right && (
      <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} />
    )}
  </TouchableOpacity>
);

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, setTheme, user, sosContactNumber, setSosContactNumber } = useAppStore();
  const { logout } = useAuth();
  const [sosPhone, setSosPhone] = React.useState(
    sosContactNumber ?? user?.emergencyContacts[0]?.phone ?? '',
  );

  const isDark = theme === 'dark';

  const handleThemeChange = (value: boolean) => {
    setTheme(value ? 'dark' as ThemeMode : 'light' as ThemeMode);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleProfile = () => {
    Alert.alert(
      user?.name ?? 'Profile',
      `Email: ${user?.email ?? 'N/A'}\nPhone: ${user?.phone ?? 'N/A'}`,
    );
  };

  const handleHealthProfile = () => {
    navigation.getParent()?.navigate('HealthProfile');
  };

  const handleSaveSosNumber = () => {
    const trimmed = sosPhone.trim();
    if (trimmed.length === 0) {
      setSosContactNumber(null);
      Alert.alert('Removed', 'No emergency contact number is configured.');
      return;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      Alert.alert('Invalid number', 'Enter a valid phone number including the country code.');
      return;
    }

    setSosContactNumber(trimmed);
    setSosPhone(trimmed);
    Alert.alert('Saved', `SOS messages will be sent to ${trimmed}.`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader icon="cog" title="Settings" subtitle="Preferences and account" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Appearance */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <SettingRow
            icon="theme-light-dark"
            label="Dark Mode"
            right={
              <Switch
                value={isDark}
                onValueChange={handleThemeChange}
                trackColor={{ false: Colors.border, true: `${Colors.primary}60` }}
                thumbColor={isDark ? Colors.primary : '#f4f3f4'}
              />
            }
          />
        </Card>

        {/* Emergency SMS */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Emergency SMS</Text>
          <Text style={styles.inputLabel}>Contact number for SOS messages</Text>
          <TextInput
            style={styles.input}
            value={sosPhone}
            onChangeText={setSosPhone}
            placeholder="+1 555 012 3456"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={20}
            accessibilityLabel="Emergency contact number"
          />
          <Text style={styles.hint}>
            The SOS button and critical alerts will text this number.
          </Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveSosNumber}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.onPrimary} />
            <Text style={styles.saveButtonText}>Save Number</Text>
          </TouchableOpacity>
        </Card>

        {/* Account */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <SettingRow icon="account" label="Profile" value={user?.name} onPress={handleProfile} />
          <View style={styles.divider} />
          <SettingRow
            icon="heart-box"
            label="Health Profile"
            value={user?.healthProfile ? 'Complete' : 'Not set'}
            onPress={handleHealthProfile}
          />
          <View style={styles.divider} />
          <SettingRow icon="logout" label="Sign Out" onPress={handleLogout} destructive />
        </Card>

        {/* About */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>About</Text>
          <SettingRow icon="information" label="Version" value="1.0.0" />
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <AppLogo size={48} withGlow={false} containerStyle={{ marginBottom: Spacing.sm }} />
          <Text style={styles.footerText}>
            Wearable Cardiac Risk Monitoring{'\n'}and Emergency Alert System
          </Text>
          <Text style={styles.footerSubtext}>For academic and research purposes only</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  card: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  saveButtonText: {
    color: Colors.onPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingIconDestructive: {
    backgroundColor: Colors.destructiveContainer,
  },
  settingLabel: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  settingValue: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.xs,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.xs * 1.4,
  },
  footerSubtext: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
});

export default SettingsScreen;
