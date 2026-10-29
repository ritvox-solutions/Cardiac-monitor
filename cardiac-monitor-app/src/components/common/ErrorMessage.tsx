import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, FontWeight, BorderRadius, Shadow } from '../../theme';

interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  variant?: 'error' | 'warning' | 'info';
}

const variantConfig = {
  error: {
    icon: 'alert-circle' as const,
    color: Colors.destructive,
    backgroundColor: Colors.destructiveContainer,
  },
  warning: {
    icon: 'alert' as const,
    color: Colors.warning,
    backgroundColor: Colors.warningContainer,
  },
  info: {
    icon: 'information' as const,
    color: Colors.primary,
    backgroundColor: Colors.primaryContainer,
  },
};

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title,
  onRetry,
  variant = 'error',
}) => {
  const config = variantConfig[variant];
  const displayTitle = title || (variant === 'error' ? 'Something went wrong' : 'Notice');

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${config.color}20` }]}>
        <MaterialCommunityIcons name={config.icon} size={32} color={config.color} />
      </View>

      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{message}</Text>

      {onRetry && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: config.color }]}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="refresh" size={16} color={Colors.onPrimary} />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.md * 1.5,
    marginBottom: Spacing.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  buttonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.onPrimary,
  },
});

export default ErrorMessage;
