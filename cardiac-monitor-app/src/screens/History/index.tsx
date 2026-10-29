import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSensorHistory, getDcsiHistory } from '../../services/api';
import { Card, Loader, ErrorMessage, ErrorBoundary, ScreenHeader } from '../../components/common';
import { HeartRateChart, DcsiChart } from '../../components/charts';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../theme';
import type { SensorData, Dcsi } from '../../types';

type TabType = 'vitals' | 'dcsi';

const HistoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('vitals');
  const [sensorHistory, setSensorHistory] = useState<SensorData[]>([]);
  const [dcsiHistory, setDcsiHistory] = useState<Dcsi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [sensors, dcis] = await Promise.all([
        getSensorHistory({ limit: 50 }),
        getDcsiHistory({ limit: 14 }),
      ]);
      setSensorHistory(sensors);
      setDcsiHistory(dcis);
    } catch {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <Loader message="Loading history..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchData} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader icon="history" title="History" subtitle="Vitals & DCSI trends" />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vitals' && styles.activeTab]}
          onPress={() => setActiveTab('vitals')}
        >
          <MaterialCommunityIcons
            name="heart-pulse"
            size={18}
            color={activeTab === 'vitals' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'vitals' && styles.activeTabText]}>
            Vitals
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dcsi' && styles.activeTab]}
          onPress={() => setActiveTab('dcsi')}
        >
          <MaterialCommunityIcons
            name="chart-bar"
            size={18}
            color={activeTab === 'dcsi' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'dcsi' && styles.activeTabText]}>DCSI</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
      >
        <ErrorBoundary
          fallback={
            <Card>
              <Text style={styles.chartFallback}>Chart unavailable</Text>
            </Card>
          }
        >
          {activeTab === 'vitals' && (
            <>
              <HeartRateChart
                data={sensorHistory.map((s) => ({
                  value: s.heartRate,
                  timestamp: s.timestamp,
                }))}
                title="Heart Rate History"
              />
              <HeartRateChart
                data={sensorHistory.map((s) => ({
                  value: s.spo2,
                  timestamp: s.timestamp,
                }))}
                title="SpO₂ History"
              />
            </>
          )}

          {activeTab === 'dcsi' && (
            <DcsiChart
              data={dcsiHistory.map((d) => ({
                score: d.score,
                date: d.date,
              }))}
              title="Daily Cardiac Stress Index"
            />
          )}
        </ErrorBoundary>

        <Card>
          <Text style={styles.sectionTitle}>
            {activeTab === 'vitals' ? 'Recent Readings' : 'Recent DCSI Values'}
          </Text>
          {(activeTab === 'vitals'
            ? sensorHistory.slice(-10).reverse()
            : dcsiHistory.slice(-10).reverse()
          ).map((item: any, index: number) => (
            <View key={index} style={styles.historyRow}>
              <Text style={styles.historyDate}>
                {new Date(item.timestamp || item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.historyValue}>
                {activeTab === 'vitals'
                  ? `${item.heartRate} bpm | ${item.spo2}%`
                  : `DCSI: ${item.score}`}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  activeTab: {
    backgroundColor: Colors.primary + '15',
  },
  tabText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  scroll: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  chartFallback: {
    textAlign: 'center',
    color: Colors.textSecondary,
    padding: Spacing.lg,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  historyValue: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
});

export default HistoryScreen;
