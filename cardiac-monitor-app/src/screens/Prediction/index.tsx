import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/useAppStore';
import { getLatestPrediction, getPredictionHistory, requestPrediction } from '../../services/api';
import { Card, Loader, ErrorMessage, ErrorBoundary, ScreenHeader } from '../../components/common';
import { RiskBadge } from '../../components/dashboard';
import { HeartRateChart } from '../../components/charts';
import { Colors, Spacing, FontSize } from '../../theme';
import { getRiskColor } from '../../utils';
import type { Prediction } from '../../types';

const PredictionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { currentPrediction, setCurrentPrediction } = useAppStore();
  const [history, setHistory] = useState<Prediction[]>([]);
  // If the BLE bridge has already produced a prediction, show it immediately —
  // don't gate the whole screen on the network.
  const [loading, setLoading] = useState(!currentPrediction);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      let [latest, hist] = await Promise.all([
        getLatestPrediction(),
        getPredictionHistory({ limit: 14 }),
      ]);
      if (!latest || latest.riskScore === 0) {
        try {
          const res = await requestPrediction();
          latest = res.prediction;
        } catch {
          // offline fallback
        }
      }
      setCurrentPrediction(latest);
      setHistory(hist);
    } catch {
      setError('Failed to load prediction data');
    } finally {
      setLoading(false);
    }
  }, [setCurrentPrediction]);

  useEffect(() => {
    fetchData();
    // Hard cap on the spinner — never leave the screen stuck loading even if a
    // request hangs past its timeout.
    const cap = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(cap);
  }, [fetchData]);

  if (loading) {
    return <Loader message="Loading predictions..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchData} />;
  }

  const scoreColor = currentPrediction
    ? getRiskColor(currentPrediction.riskLevel)
    : Colors.textSecondary;

  // Only feed the charts entries with a real numeric score.
  const chartPoints = history.filter(
    (p) => typeof p.riskScore === 'number' && Number.isFinite(p.riskScore),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        icon="chart-line"
        title="Risk Prediction"
        subtitle="Your cardiac risk assessment"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
      >
        {currentPrediction && (
          <Card elevated>
            <View style={styles.scoreContainer}>
              <Text style={[styles.scoreValue, { color: scoreColor }]}>
                {currentPrediction.riskScore}
              </Text>
              <Text style={styles.scoreLabel}>Risk Score</Text>
            </View>
            <RiskBadge level={currentPrediction.riskLevel} size="md" />
            <View style={styles.probabilityBar}>
              <View
                style={[
                  styles.probabilityFill,
                  {
                    width: `${Math.min(100, Math.max(0, (currentPrediction.probability ?? 0) * 100))}%`,
                    backgroundColor: scoreColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.probabilityText}>
              Confidence: {((currentPrediction.probability ?? 0) * 100).toFixed(1)}%
            </Text>
          </Card>
        )}

        <ErrorBoundary
          fallback={
            <Card>
              <Text style={styles.chartFallback}>Risk score chart unavailable</Text>
            </Card>
          }
        >
          <HeartRateChart
            data={chartPoints.map((p) => ({ value: p.riskScore, timestamp: p.timestamp }))}
            title="Risk Score Trend"
          />
        </ErrorBoundary>
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
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  scoreValue: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  probabilityBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
    borderRadius: 3,
  },
  probabilityText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  chartFallback: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: Spacing.lg,
  },
});

export default PredictionScreen;
