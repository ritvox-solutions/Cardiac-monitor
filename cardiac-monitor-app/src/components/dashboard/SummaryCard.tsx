import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../common';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme';

interface SummaryCardProps {
  title: string;
  value: string;
  unit?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  unit,
  icon,
  color,
  subtitle,
  trend,
  trendValue,
}) => {
  const showTrend = trend !== undefined && trend !== 'stable';

  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}18` }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={[styles.unit, { color }]}>{unit}</Text>}
        {showTrend && trendValue && (
          <View style={[styles.trend, { marginLeft: Spacing.sm }]}>
            <MaterialCommunityIcons
              name={trend === 'up' ? 'trending-up' : 'trending-down'}
              size={FontSize.sm}
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
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: Spacing.xs,
    minWidth: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  value: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  unit: {
    fontSize: FontSize.sm,
    marginLeft: Spacing.xs,
    fontWeight: FontWeight.medium,
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
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

export default SummaryCard;