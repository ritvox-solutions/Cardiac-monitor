import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useBluetooth } from '../../hooks/useBluetooth';
import {
  getLatestSensorData,
  getLatestPrediction,
  getCurrentDcsi,
  requestPrediction,
} from '../../services/api';
import {
  resetVitalsToNormal,
  resetToLiveBleVitals,
} from '../../services/crisisSimulator';
import { Card, MetricTile, Loader, ErrorMessage, ScreenHeader } from '../../components/common';
import { RiskBadge, DcsiGauge } from '../../components/dashboard';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme';
import { formatHeartRate, formatSpO2, getHeartRateColor, getSpO2Color } from '../../utils';
import type { MainTabParamList } from '../../navigation/AppNavigator';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Wearable Not Connected',
  scanning: 'Searching for watch...',
  connecting: 'Connecting to watch...',
  connected: 'Connected & Streaming',
  disconnected: 'Wearable Disconnected',
  error: 'Connection Error',
};

const STATUS_COLOR: Record<string, string> = {
  idle: Colors.textTertiary,
  scanning: Colors.warning,
  connecting: Colors.warning,
  connected: Colors.status.healthy,
  disconnected: Colors.textTertiary,
  error: Colors.destructive,
};

const STATUS_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  idle: 'bluetooth-off',
  scanning: 'bluetooth-transfer',
  connecting: 'bluetooth-connect',
  connected: 'bluetooth-connect',
  disconnected: 'bluetooth-off',
  error: 'alert-circle',
};

const DashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const {
    currentSensorData,
    currentPrediction,
    currentDcsi,
    setCurrentSensorData,
    setCurrentPrediction,
    setCurrentDcsi,
  } = useAppStore();

  const {
    bleStatus,
    bleDeviceName,
    bleSensorData,
    bleError,
    isConnected,
    requestPermissions,
    startScanning,
    disconnect,
    clearBleError,
  } = useBluetooth();

  const handleConnect = async () => {
    clearBleError();
    const granted = await requestPermissions();
    if (!granted) return;
    await startScanning();
  };

  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRunAssessment = async () => {
    try {
      setAnalyzing(true);
      await requestPrediction();
    } catch (err) {
      console.warn('ML assessment failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      let [sensor, prediction, dcsi] = await Promise.all([
        getLatestSensorData(),
        getLatestPrediction(),
        getCurrentDcsi(),
      ]);

      // If no prediction loaded yet, run real-time ML inference against live backend
      if (!prediction || prediction.riskScore === 0) {
        try {
          const res = await requestPrediction();
          prediction = res.prediction;
          dcsi = res.dcsi;
        } catch {
          // offline fallback
        }
      }

      setCurrentSensorData(sensor);
      setCurrentPrediction(prediction);
      setCurrentDcsi(dcsi);
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [setCurrentSensorData, setCurrentPrediction, setCurrentDcsi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // If simulated vitals are active on Dashboard without a physical watch sending 110+ BPM, auto-recover to live/last BLE in 4s
  useEffect(() => {
    if (currentSensorData && currentSensorData.heartRate > 110 && !isConnected) {
      const timer = setTimeout(() => {
        void resetToLiveBleVitals();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [currentSensorData, isConnected]);

  if (loading) {
    return <Loader message="Loading your health data..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchData} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        useAppLogo
        title="Health Overview"
        subtitle={new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={Colors.primary} />
        }
      >
        {/* Device Connection Card */}
        <Card style={styles.deviceCard}>
          <View style={styles.deviceCardHeader}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_COLOR[bleStatus] || Colors.textTertiary },
                ]}
              />
              <MaterialCommunityIcons
                name={STATUS_ICON[bleStatus] ?? 'bluetooth'}
                size={18}
                color={STATUS_COLOR[bleStatus] || Colors.textTertiary}
                style={styles.statusIcon}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: STATUS_COLOR[bleStatus] || Colors.textTertiary },
                ]}
              >
                {STATUS_LABEL[bleStatus] ?? bleStatus}
              </Text>
            </View>

            {bleSensorData?.battery != null && isConnected && (
              <View style={styles.batteryRow}>
                <MaterialCommunityIcons
                  name={
                    bleSensorData.battery > 50
                      ? 'battery-high'
                      : bleSensorData.battery > 20
                      ? 'battery-medium'
                      : 'battery-low'
                  }
                  size={16}
                  color={bleSensorData.battery > 20 ? Colors.status.healthy : Colors.warning}
                />
                <Text style={styles.batteryText}>{bleSensorData.battery}%</Text>
              </View>
            )}
          </View>

          {bleDeviceName && isConnected && (
            <View style={styles.deviceDetailsRow}>
              <MaterialCommunityIcons name="watch-variant" size={15} color={Colors.textSecondary} />
              <Text style={styles.deviceName}>{bleDeviceName}</Text>
            </View>
          )}

          {bleError && (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={Colors.destructive} />
              <Text style={styles.errorText}>{bleError}</Text>
            </View>
          )}

          {!isConnected ? (
            <TouchableOpacity
              style={[
                styles.connectButton,
                (bleStatus === 'scanning' || bleStatus === 'connecting') && styles.connectButtonDisabled,
              ]}
              onPress={handleConnect}
              disabled={bleStatus === 'scanning' || bleStatus === 'connecting'}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={bleStatus === 'scanning' ? 'bluetooth-transfer' : 'bluetooth'}
                size={18}
                color={Colors.onPrimary}
              />
              <Text style={styles.connectButtonText}>
                {bleStatus === 'scanning'
                  ? 'Searching for Watch...'
                  : bleStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Connect to Watch'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.connectedActionsRow}>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={disconnect}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="bluetooth-off" size={16} color={Colors.destructive} />
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.liveViewButton}
                onPress={() => navigation.navigate('LiveMonitoring')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={16} color={Colors.primary} />
                <Text style={styles.liveViewButtonText}>Live Monitor</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Live ML Assessment Action */}
          <TouchableOpacity
            style={[styles.assessButton, analyzing && styles.assessButtonDisabled]}
            onPress={handleRunAssessment}
            disabled={analyzing}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="brain"
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.assessButtonText}>
              {analyzing ? 'Analyzing with ML Model...' : 'Run Live ML Risk Assessment'}
            </Text>
          </TouchableOpacity>

          {/* Quick SOS & Emergency Navigation */}
          <TouchableOpacity
            style={styles.sosQuickButton}
            onPress={() => navigation.navigate('Emergency', { autoStart: true })}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="alert-octagon"
              size={18}
              color={Colors.destructive}
            />
            <Text style={styles.sosQuickButtonText}>
              Launch Autonomous SOS Demo
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Reset Simulated Vitals Banner */}
          {currentSensorData && currentSensorData.heartRate > 110 && !isConnected && (
            <TouchableOpacity
              style={styles.simActiveBanner}
              onPress={async () => {
                await resetVitalsToNormal();
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="restore" size={16} color={Colors.warning} />
              <Text style={styles.simActiveBannerText}>
                Demo Vitals Active ({Math.round(currentSensorData.heartRate)} BPM) · Tap to Reset Normal
              </Text>
            </TouchableOpacity>
          )}
        </Card>
        {currentPrediction && (
          <Card style={styles.riskCard}>
            <View style={styles.cardHeaderWithBadge}>
              <Text style={styles.sectionTitle}>CARDIAC RISK PREDICTION</Text>
              <View style={styles.liveTag}>
                <View style={styles.liveTagDot} />
                <Text style={styles.liveTagText}>LIVE ML</Text>
              </View>
            </View>
            <View style={styles.riskRow}>
              <RiskBadge
                level={currentPrediction.riskLevel}
                score={currentPrediction.riskScore}
                size="lg"
              />
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceValue}>
                  {(currentPrediction.probability * 100).toFixed(0)}%
                </Text>
                <Text style={styles.confidenceLabel}>model confidence</Text>
              </View>
            </View>
          </Card>
        )}

        {currentSensorData && (
          <View style={styles.metricsRow}>
            <MetricTile
              label="Heart Rate"
              value={formatHeartRate(currentSensorData.heartRate)}
              color={getHeartRateColor(currentSensorData.heartRate)}
              icon="heart-pulse"
              size="md"
            />
            <View style={styles.metricGap} />
            <MetricTile
              label="SpO₂"
              value={formatSpO2(currentSensorData.spo2)}
              color={getSpO2Color(currentSensorData.spo2)}
              icon="water-percent"
              size="md"
            />
          </View>
        )}

        {currentDcsi && (
          <Card>
            <DcsiGauge score={currentDcsi.score} size="lg" />
          </Card>
        )}
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
    paddingBottom: Spacing.xxl,
  },
  riskCard: {
    marginBottom: Spacing.md,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  confidenceValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  confidenceLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  metricGap: {
    width: Spacing.sm,
  },
  deviceCard: {
    marginBottom: Spacing.md,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusIcon: {
    marginLeft: 2,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  batteryText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  deviceDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  deviceName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.destructiveContainer,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.xs,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.destructive,
    flex: 1,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  connectButtonDisabled: {
    opacity: 0.7,
  },
  connectButtonText: {
    color: Colors.onPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  connectedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  disconnectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceVariant,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disconnectButtonText: {
    color: Colors.destructive,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  liveViewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  liveViewButtonText: {
    color: Colors.primaryDark,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  assessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  assessButtonDisabled: {
    opacity: 0.6,
  },
  assessButtonText: {
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  cardHeaderWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  liveTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.accentDark,
    letterSpacing: 0.5,
  },
  sosQuickButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.destructive + '12',
    borderWidth: 1,
    borderColor: Colors.destructive + '30',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sosQuickButtonText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.destructive,
  },
  simActiveBanner: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warning + '18',
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  simActiveBannerText: {
    flex: 1,
    fontSize: FontSize.xs - 1,
    fontWeight: '600',
    color: Colors.warning,
  },
});

export default DashboardScreen;
