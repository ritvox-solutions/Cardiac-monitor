import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { Card } from '../common';

interface HeartRateChartProps {
  data: Array<{ value: number; timestamp: string }>;
  title?: string;
  color?: string;
  showDots?: boolean;
}

const HeartRateChart: React.FC<HeartRateChartProps> = ({
  data,
  title,
  color = Colors.primary,
  showDots = true,
}) => {
  const screenWidth = Dimensions.get('window').width - Spacing.lg * 2;

  // Drop points the chart library can't plot (NaN / Infinity / non-numbers)
  const points = data
    .filter((d) => typeof d.value === 'number' && Number.isFinite(d.value))
    .slice(-30); // Show last 30 points for better trend visualization

  if (points.length < 2) {
    return (
      <Card>
        <Text style={styles.emptyText}>Not enough data yet</Text>
      </Card>
    );
  }

  const chartData = {
    labels: points.map((d) => {
      const date = new Date(d.timestamp);
      return Number.isNaN(date.getTime())
        ? ''
        : `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }),
    datasets: [
      {
        data: points.map((d) => d.value),
        color: () => color,
        strokeWidth: 2.5,
      },
    ],
  };

  return (
    <Card>
      {title && <Text style={styles.title}>{title}</Text>}
      <LineChart
        data={chartData}
        width={screenWidth}
        height={200}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={{
          backgroundColor: Colors.surface,
          backgroundGradientFrom: Colors.surface,
          backgroundGradientTo: Colors.surface,
          decimalPlaces: 0,
          color: (opacity = 1) => {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
          },
          labelColor: () => Colors.textSecondary,
          fillShadowGradientFrom: color,
          fillShadowGradientFromOpacity: 0.18,
          fillShadowGradientTo: color,
          fillShadowGradientToOpacity: 0.02,
          propsForDots: showDots
            ? {
                r: '5',
                strokeWidth: '2.5',
                stroke: color,
                fill: Colors.surface,
              }
            : { r: '0' },
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
        bezier
        fromZero={false}
        withInnerLines
        withOuterLines={false}
        style={styles.chart}
      />
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
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: Spacing.lg,
  },
});

export default HeartRateChart;