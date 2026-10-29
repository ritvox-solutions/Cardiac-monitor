import React from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

export type CardElevation = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevation?: CardElevation;
  /** Legacy alias for `elevation="md"` used by existing screens. */
  elevated?: boolean;
  bordered?: boolean;
  pressable?: boolean;
  onPress?: () => void;
  testID?: string;
}

const elevationStyles = {
  none: {},
  xs: Shadow.xs,
  sm: Shadow.sm,
  md: Shadow.md,
  lg: Shadow.lg,
  xl: Shadow.xl,
};

const Card: React.FC<CardProps> = ({
  children,
  style,
  elevation = 'md',
  elevated = false,
  bordered = true,
  pressable = false,
  onPress,
  testID,
}) => {
  const isPressable = pressable && typeof onPress === 'function';
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    elevationStyles[elevated ? 'md' : elevation],
    bordered && styles.bordered,
    isPressable && styles.pressable,
    style,
  ];

  if (isPressable) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.9}
        testID={testID}
        accessible
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} testID={testID}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  pressable: {
    // Subtle press feedback handled by activeOpacity
  },
});

export default Card;