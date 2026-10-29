import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { Card } from '../common';
import { getRiskColor } from '../../utils';

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function tierForScore(score: number): string {
  return score <= 30 ? 'healthy' : score <= 60 ? 'moderate' : score <= 80 ? 'high' : 'critical';
}

interface DcsiChartProps {
  data: Array<{ score: number; date: string }>;
  title?: string;
}

const DcsiChart: React.FC<DcsiChartProps> = ({ data, title }) => {
  const screenWidth = Dimensions.get('window').width - Spacing.lg * 2;

  const recent = data
    .filter((d) => typeof d.score === 'number' && Number.isFinite(d.score))
    .slice(-14); // Show last 14 days

  if (recent.length === 0) {
    return (
      <Card>
        <Text style={styles.emptyText}>Not enough data yet</Text>
      </Card>
    );
  }

  const chartData = {
    labels: recent.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        data: recent.map((d) => d.score),
        colors: recent.map((d) => {
          const barColor = getRiskColor(tierForScore(d.score));
          return (opacity = 1) => hexToRgba(barColor, opacity);
        }),
      },
    ],
  };

  return (
    <Card>
      {title && <Text style={styles.title}>{title}</Text>}
      <BarChart
        data={chartData}
        width={screenWidth}
        height={200}
        yAxisLabel=""
        yAxisSuffix=""
        fromZero
        withCustomBarColorFromData
        flatColor={false}
        chartConfig={{
          backgroundColor: Colors.surface,
          backgroundGradientFrom: Colors.surface,
          backgroundGradientTo: Colors.surface,
          decimalPlaces: 0,
          color: () => Colors.primary,
          labelColor: () => Colors.textSecondary,
          barPercentage: 0.7,
          barRadius: 6,
          propsForBackgroundLines: {
            strokeDasharray: '4,4',
            stroke: Colors.divider,
            strokeWidth: 1,
          },
          propsForLabels: {
            fontSize: 10,
            fill: Colors.textSecondary,
          },
        }}
        style={styles.chart}
      />
      {/* Tier reference bands */}
      <View style={styles.tierBands}>
        <View style={[styles.tierBand, { backgroundColor: `${Colors.status.healthy}15` }]} />
        <View style={[styles.tierBand, { backgroundColor: `${Colors.status.moderate}15`, top: '30%' }]} />
        <View style={[styles.tierBand, { backgroundColor: `${Colors.status.high}15`, top: '60%' }]} />
        <View style={[styles.tierBand, { backgroundColor: `${Colors.status.critical}15`, top: '80%' }]} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  chart: {
    borderRadius: BorderRadius.md,
    position: 'relative',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: Spacing.lg,
  },
  tierBands: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  tierBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '20%',
  },
});

export default DcsiChart;