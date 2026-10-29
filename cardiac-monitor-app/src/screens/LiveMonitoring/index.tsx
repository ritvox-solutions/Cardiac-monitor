import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useBluetooth } from '../../hooks/useBluetooth';
import { Card, MetricTile, ScreenHeader } from '../../components/common';
import { RiskBadge } from '../../components/dashboard';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../../theme';
import { getHeartRateColor, getSpO2Color } from '../../utils';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Not connected',
  scanning: 'Scanning for device...',
  connecting: 'Connecting...',
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Connection error',
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
  scanning: 'bluetooth-settings',
  connecting: 'bluetooth-transfer',
  connected: 'bluetooth-audio',
  disconnected: 'bluetooth-off',
  error: 'bluetooth-off',
};

const LiveMonitoringScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { currentPrediction, predictionStatus, predictionError } = useAppStore();
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        icon="heart-pulse"
        title="Live Monitoring"
        subtitle={isConnected ? 'Streaming from device' : 'Connect your wearable to start'}
        tint={isConnected ? Colors.status.healthy : Colors.textTertiary}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Connection Status Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[bleStatus] }]} />
            <MaterialCommunityIcons
              name={STATUS_ICON[bleStatus] ?? 'bluetooth'}
              size={16}
              color={STATUS_COLOR[bleStatus]}
              style={styles.statusIcon}
            />
            <Text style={[styles.statusText, { color: STATUS_COLOR[bleStatus] }]}>
              {STATUS_LABEL[bleStatus] ?? bleStatus}
            </Text>
          </View>

          {bleDeviceName && (
            <View style={styles.deviceRow}>
              <MaterialCommunityIcons name="watch-variant" size={14} color={Colors.textSecondary} />
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
              style={styles.connectButton}
              onPress={handleConnect}
              disabled={bleStatus === 'scanning' || bleStatus === 'connecting'}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="bluetooth" size={18} color={Colors.onPrimary} />
              <Text style={styles.connectButtonText}>
                {bleStatus === 'scanning' || bleStatus === 'connecting'
                  ? 'Searching...'
                  : 'Connect to Watch'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.disconnectButton} onPress={disconnect} activeOpacity={0.8}>
              <MaterialCommunityIcons name="bluetooth-off" size={18} color={Colors.destructive} />
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Live Data */}
        {bleSensorData ? (
          <>
            {/* Heart Rate Display */}
            <Card style={styles.heartCard}>
              <View style={styles.heartHeader}>
                <MaterialCommunityIcons name="heart-pulse" size={16} color={Colors.destructive} />
                <Text style={styles.heartLabel}>HEART RATE</Text>
              </View>
              <View style={styles.heartContainer}>
                <Text
                  style={[
                    styles.heartRate,
                    { color: getHeartRateColor(bleSensorData.heartRate) },
                  ]}
                >
                  {Math.round(bleSensorData.heartRate)}
                </Text>
                <Text style={styles.heartUnit}>bpm</Text>
              </View>
            </Card>

            {/* Secondary Metrics */}
            <View style={styles.metricsGrid}>
              <MetricTile
                label="SpO₂"
                value={String(Math.round(bleSensorData.spo2))}
                unit="%"
                color={getSpO2Color(bleSensorData.spo2)}
                icon="water-percent"
                size="md"
              />
              <MetricTile
                label="Temp"
                value={bleSensorData.temperature.toFixed(1)}
                unit="°C"
                color={Colors.primary}
                icon="thermometer"
                size="md"
              />
              <MetricTile
                label="Battery"
                value={String(Math.round(bleSensorData.battery))}
                unit="%"
                color={bleSensorData.battery > 20 ? Colors.accent : Colors.warning}
                icon="battery-medium"
                size="md"
              />
            </View>

            {/* Cardiac Risk */}
            <Card>
              <Text style={styles.sectionTitle}>Cardiac Risk</Text>
              {currentPrediction ? (
                <>
                  <RiskBadge
                    level={currentPrediction.riskLevel}
                    score={currentPrediction.riskScore}
                    size="lg"
                  />
                  <Text style={styles.predictionTimestamp}>
                    Updated {new Date(currentPrediction.timestamp).toLocaleTimeString()}
                    {predictionStatus === 'error' ? ' · retrying' : ''}
                  </Text>
                </>
              ) : predictionStatus === 'error' && predictionError ? (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons name="alert-circle" size={14} color={Colors.destructive} />
                  <Text style={styles.errorText}>{predictionError}</Text>
                </View>
              ) : (
                <View style={styles.waitingContainer}>
                  <MaterialCommunityIcons name="chart-line" size={24} color={Colors.textTertiary} />
                  <Text style={styles.waitingText}>
                    {predictionStatus === 'pending'
                      ? 'Calculating your cardiac risk...'
                      : 'Waiting for your first reading...'}
                  </Text>
                </View>
              )}
            </Card>
          </>
        ) : (
          isConnected && (
            <Card style={styles.instructionCard}>
              <View style={styles.instructionIcon}>
                <MaterialCommunityIcons name="fingerprint" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.instructionTitle}>Watch Connected</Text>
              <Text style={styles.instructionText}>
                Place your finger gently on the sensor. Your pulse and SpO₂ readings will stream
                automatically.
              </Text>
            </Card>
          )
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
  statusCard: {
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusIcon: {
    marginRight: Spacing.xs,
  },
  statusText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingLeft: Spacing.md,
  },
  deviceName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.destructiveContainer,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  errorText: {
    color: Colors.destructive,
    fontSize: FontSize.sm,
    flex: 1,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 4,
    marginTop: Spacing.md,
    ...Shadow.primary,
  },
  connectButtonText: {
    color: Colors.onPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.destructiveContainer,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 4,
    marginTop: Spacing.md,
  },
  disconnectButtonText: {
    color: Colors.destructive,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  heartCard: {
    marginBottom: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  heartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heartLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    fontWeight: FontWeight.semibold,
  },
  heartContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  heartRate: {
    fontSize: 72,
    fontWeight: '300',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  heartUnit: {
    fontSize: FontSize.xl,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
    fontWeight: FontWeight.medium,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  predictionTimestamp: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  waitingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  instructionCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  instructionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  instructionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  instructionText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.md * 1.5,
    paddingHorizontal: Spacing.lg,
  },
});

export default LiveMonitoringScreen;
