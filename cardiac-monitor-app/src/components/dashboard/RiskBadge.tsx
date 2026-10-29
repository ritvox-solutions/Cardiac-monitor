import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme';
import { getRiskColor, getRiskLabel, getRiskIcon } from '../../utils';

interface RiskBadgeProps {
  level: string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  variant?: 'chip' | 'badge' | 'dot';
}

const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  size = 'md',
  showIcon = true,
  variant = 'chip',
}) => {
  const color = getRiskColor(level);
  const label = getRiskLabel(level);
  const icon = getRiskIcon(level);

  const dimensions = {
    sm: { paddingH: 8, paddingV: 3, text: 11, icon: 12, gap: 3 },
    md: { paddingH: 12, paddingV: 6, text: 13, icon: 15, gap: 4 },
    lg: { paddingH: 16, paddingV: 10, text: 16, icon: 20, gap: 6 },
  };

  const dim = dimensions[size];

  if (variant === 'dot') {
    return (
      <View style={styles.dotContainer}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.dotText, { color }]}>{label}</Text>
        {score !== undefined && (
          <Text style={[styles.dotScore, { color }]}>· {score}</Text>
        )}
      </View>
    );
  }

  if (variant === 'badge') {
    return (
      <View style={[styles.badgeContainer, { backgroundColor: `${color}15`, borderColor: `${color}40` }, { paddingHorizontal: dim.paddingH, paddingVertical: dim.paddingV }]}>
        {showIcon && <MaterialCommunityIcons name={icon} size={dim.icon} color={color} />}
        <Text style={[styles.badgeText, { color, fontSize: dim.text }]}>{label}</Text>
        {score !== undefined && (
          <Text style={[styles.badgeScore, { color, fontSize: dim.text }]}>· {score}</Text>
        )}
      </View>
    );
  }

  // Default: chip variant
  return (
    <View style={[styles.chipContainer, { backgroundColor: `${color}15`, borderColor: `${color}40` }, { paddingHorizontal: dim.paddingH, paddingVertical: dim.paddingV }]}>
      {showIcon && <MaterialCommunityIcons name={icon} size={dim.icon} color={color} />}
      <Text style={[styles.chipText, { color, fontSize: dim.text }]}>{label}</Text>
      {score !== undefined && (
        <Text style={[styles.chipScore, { color, fontSize: dim.text }]}>· {score}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 4,
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  dotScore: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  chipText: {
    fontWeight: FontWeight.bold,
  },
  chipScore: {
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
  badgeText: {
    fontWeight: FontWeight.bold,
  },
  badgeScore: {
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
});

export default RiskBadge;