import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme';
import AppLogo from './AppLogo';

interface ScreenHeaderProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  useAppLogo?: boolean;
  title: string;
  subtitle?: string;
  tint?: string;
  accessory?: React.ReactNode;
  action?: React.ReactNode;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  icon = 'heart-pulse',
  useAppLogo = false,
  title,
  subtitle,
  tint = Colors.primary,
  accessory,
  action,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {useAppLogo ? (
          <AppLogo size={38} withGlow={false} rounded />
        ) : (
          <View style={[styles.iconBadge, { backgroundColor: `${tint}15` }]}>
            <MaterialCommunityIcons name={icon} size={20} color={tint} />
          </View>
        )}
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {accessory}
        {action}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
    lineHeight: FontSize.sm * 1.4,
  },
});

export default ScreenHeader;