import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '../../theme';

interface MetricTileProps {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  testID?: string;
}

const sizeConfig = {
  sm: { padding: Spacing.sm, valueSize: FontSize.lg, iconSize: 14, badgeSize: 20 },
  md: { padding: Spacing.md, valueSize: FontSize.xxl, iconSize: 16, badgeSize: 24 },
  lg: { padding: Spacing.lg, valueSize: FontSize.xxxl, iconSize: 20, badgeSize: 32 },
};

const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  unit,
  color = Colors.primary,
  icon,
  trend,
  trendValue,
  size = 'md',
  onPress,
  testID,
}) => {
  const config = sizeConfig[size];
  const showTrend = trend !== undefined && trend !== 'stable';

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    { padding: config.padding },
    onPress && styles.pressable,
  ];

  const content = (
    <>
      <View style={[styles.headerRow, { gap: Spacing.xs }]}>
        {icon && (
          <View style={[styles.iconBadge, { backgroundColor: `${color}18`, width: config.badgeSize, height: config.badgeSize }]}>
            <MaterialCommunityIcons name={icon} size={config.iconSize} color={color} />
          </View>
        )}
        <Text style={[styles.label, { fontSize: FontSize.xs }]}>{label}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color, fontSize: config.valueSize }]}>{value}</Text>
        {unit && <Text style={[styles.unit, { color, fontSize: FontSize.sm }]}>{unit}</Text>}
        {showTrend && trendValue && (
          <View style={[styles.trend, { marginLeft: Spacing.xs }]}>
            <MaterialCommunityIcons
              name={trend === 'up' ? 'trending-up' : 'trending-down'}
              size={FontSize.md}
              color={trend === 'up' ? Colors.status.healthy : Colors.destructive}
            />
            <Text
              style={[
                styles.trendValue,
                { color: trend === 'up' ? Colors.status.healthy : Colors.destructive },
              ]}
            >
              {trendValue}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.accent, { backgroundColor: color }]} />
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.9}
        testID={testID}
        accessible
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  iconBadge: {
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: FontWeight.medium,
    flexShrink: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  value: {
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  unit: {
    fontWeight: FontWeight.medium,
    marginLeft: Spacing.xs,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  pressable: {
    // Press feedback via activeOpacity
  },
});

export default MetricTile;