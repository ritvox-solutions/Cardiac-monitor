import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme';
import { getRiskColor, getRiskLabel, getRiskIcon, getDcsiTier } from '../../utils';

interface DcsiGaugeProps {
  score: number;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

// Segment configuration matching DCSI tiers: 0-30 healthy, 31-60 moderate, 61-80 high, 81-100 critical
const SEGMENTS = [
  { tier: 'healthy', key: 'healthy', flex: 30, color: Colors.status.healthy, label: 'Healthy' },
  { tier: 'moderate', key: 'moderate', flex: 30, color: Colors.status.moderate, label: 'Moderate' },
  { tier: 'high', key: 'high', flex: 20, color: Colors.status.high, label: 'High' },
  { tier: 'critical', key: 'critical', flex: 20, color: Colors.status.critical, label: 'Critical' },
] as const;

const sizeConfig = {
  sm: { scoreSize: 28, gaugeHeight: 8, labelSize: 7, iconSize: 10, padding: Spacing.sm },
  md: { scoreSize: 38, gaugeHeight: 12, labelSize: 9, iconSize: 13, padding: Spacing.md },
  lg: { scoreSize: 48, gaugeHeight: 16, labelSize: 10, iconSize: 16, padding: Spacing.lg },
};

const DcsiGauge: React.FC<DcsiGaugeProps> = ({ score, animated = true, size = 'md', showLabels = true }) => {
  const config = sizeConfig[size];
  const clampedScore = Math.min(100, Math.max(0, score));
  const tier = getDcsiTier(clampedScore);
  const color = getRiskColor(tier);
  const label = getRiskLabel(tier);
  const icon = getRiskIcon(tier);

  // Animated marker position
  const markerAnim = React.useRef(new Animated.Value(0)).current;
  const scoreAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.timing(markerAnim, {
          toValue: clampedScore,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(scoreAnim, {
          toValue: clampedScore,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      markerAnim.setValue(clampedScore);
      scoreAnim.setValue(clampedScore);
    }
  }, [clampedScore, animated, markerAnim, scoreAnim]);

  const markerLeft = markerAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const animatedScore = scoreAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 100],
  });

  return (
    <View style={[styles.container, { padding: config.padding }]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>DAILY CARDIAC STRESS INDEX</Text>
        <View style={styles.tierChip}>
          <MaterialCommunityIcons name={icon} size={config.iconSize} color={color} />
          <Text style={[styles.tierChipText, { color }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <Animated.Text
          style={[
            styles.scoreValue,
            { color, fontSize: config.scoreSize },
          ]}
        >
          {animatedScore}
        </Animated.Text>
        <Text style={[styles.scoreMax, { fontSize: size === 'sm' ? FontSize.sm : FontSize.md }]}>/100</Text>
      </View>

      <View style={[styles.gaugeTrack, { height: config.gaugeHeight }]}>
        {SEGMENTS.map((seg, i) => (
          <Animated.View
            key={seg.key}
            style={[
              styles.segment,
              {
                flex: seg.flex,
                backgroundColor: seg.color,
                marginRight: i < SEGMENTS.length - 1 ? 2 : 0,
              },
            ]}
          />
        ))}
        <Animated.View
          style={[
            styles.marker,
            { left: markerLeft, height: config.gaugeHeight + 6 },
          ]}
        />
      </View>

      {showLabels && (
        <View style={styles.tierRow}>
          {SEGMENTS.map((seg) => (
            <Text key={seg.key} style={[styles.tier, { fontSize: config.labelSize }]}>
              {seg.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    fontWeight: FontWeight.semibold,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceVariant,
  },
  tierChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  scoreValue: {
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  scoreMax: {
    color: Colors.textSecondary,
    marginLeft: 2,
    fontWeight: FontWeight.medium,
  },
  gaugeTrack: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    overflow: 'visible',
  },
  segment: {
    height: '100%',
    borderRadius: 3,
  },
  marker: {
    position: 'absolute',
    top: -3,
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.text,
    borderWidth: 2,
    borderColor: Colors.surface,
    transform: [{ translateX: -2 }],
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  tier: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
});

export default DcsiGauge;