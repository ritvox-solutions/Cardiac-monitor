import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppStore } from '../../store/useAppStore';
import {
  sendAutomaticSms,
  checkSmsPermission,
  requestSmsPermission,
  openAppSettings,
  openNativeSmsApp,
} from '../../services/nativeSms';
import {
  addEmergencyContact,
  getEmergencyAlerts,
  getEmergencyContacts,
  removeEmergencyContact,
  triggerEmergencyAlert,
} from '../../services/api/emergency';
import { Card, Loader, ErrorMessage, ScreenHeader, GradientView } from '../../components/common';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../theme';
import { emergencyContactSchema } from '../../utils/validation';
import {
  simulateAutonomousSos,
  resetToLiveBleVitals,
  resetVitalsToNormal,
  type SimulationProgress,
  type ResetResult,
} from '../../services/crisisSimulator';
import type { MainTabParamList } from '../../navigation/AppNavigator';
import type { EmergencyAlert, EmergencyContact } from '../../types';
import type { EmergencyContactForm } from '../../utils/validation';

const EmergencyScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<MainTabParamList, 'Emergency'>>();
  const autoStart = route.params?.autoStart;
  const hasAutoStartedRef = useRef(false);

  const {
    emergencyAlerts,
    setEmergencyAlerts,
    currentSensorData,
    bleStatus,
    sosContactNumber,
    setSosContactNumber,
    user,
  } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [resettingVitals, setResettingVitals] = useState(false);
  const [autoResetSeconds, setAutoResetSeconds] = useState<number | null>(null);
  const [restoredSource, setRestoredSource] = useState<'live_ble' | 'last_ble' | 'baseline' | null>(null);
  const [simulationProgress, setSimulationProgress] = useState<SimulationProgress | null>(null);
  const [simulationResult, setSimulationResult] = useState<{
    recipient: string;
    heartRate: number;
    spo2: number;
    riskScore: number;
    locationUrl: string;
  } | null>(null);
  const [smsPermissionGranted, setSmsPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [contactForm, setContactForm] = useState<EmergencyContactForm>({
    name: '',
    phone: '',
    relationship: '',
  });
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof EmergencyContactForm, string>>>({});

  // Direct quick emergency mobile number management
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [quickPhoneInput, setQuickPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const rawRecipient =
    sosContactNumber?.trim() ||
    user?.emergencyContacts?.[0]?.phone ||
    contacts[0]?.phone ||
    '';
  const isDummyRecipient =
    !rawRecipient ||
    rawRecipient.includes('555-0124') ||
    rawRecipient.includes('555-0125') ||
    rawRecipient.includes('5550124') ||
    rawRecipient.includes('+1555') ||
    rawRecipient.replace(/[^0-9]/g, '').length < 7;

  const handleOpenPhoneModal = () => {
    setQuickPhoneInput(sosContactNumber || (isDummyRecipient ? '' : rawRecipient));
    setPhoneError(null);
    setPhoneModalVisible(true);
  };

  const handleSaveQuickPhone = () => {
    const cleaned = quickPhoneInput.trim().replace(/[^0-9+]/g, '');
    if (cleaned.length < 8) {
      setPhoneError('Please enter a valid mobile number (min 8 digits)');
      return;
    }
    if (cleaned.includes('5550124') || cleaned.includes('5550125')) {
      setPhoneError('Please enter a real phone number, not a dummy test number');
      return;
    }
    setSosContactNumber(cleaned);
    setPhoneModalVisible(false);
    Alert.alert('Emergency Contact Saved', `Emergency SMS alerts will be sent to ${cleaned}`);
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [alerts, contactList, smsGranted] = await Promise.all([
        getEmergencyAlerts(),
        getEmergencyContacts(),
        checkSmsPermission(),
      ]);
      setEmergencyAlerts(alerts);
      setContacts(contactList);
      setSmsPermissionGranted(smsGranted);
    } catch {
      setError('Failed to load emergency data');
    } finally {
      setLoading(false);
    }
  }, [setEmergencyAlerts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSOS = async () => {
    const { sosContactNumber: currentSos, user: currentUser, bleSensorData } = useAppStore.getState();
    const recipient =
      currentSos?.trim() ||
      currentUser?.emergencyContacts?.[0]?.phone ||
      contacts[0]?.phone;

    const isDummy =
      !recipient ||
      recipient.includes('555-0124') ||
      recipient.includes('555-0125') ||
      recipient.includes('5550124') ||
      recipient.includes('+1555') ||
      recipient.replace(/[^0-9]/g, '').length < 7;

    if (isDummy) {
      Alert.alert(
        'Set Real Mobile Number',
        'Please set your real 10-digit mobile number before sending an SOS. Carrier SMS cannot be delivered to dummy numbers (+1-555-0124).',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Mobile Number', onPress: handleOpenPhoneModal },
        ],
      );
      return;
    }

    Alert.alert(
      'Send Emergency Alert',
      `This will text your emergency contact (${recipient}) with your current location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required.');
                return;
              }

              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
              });
              const { latitude, longitude } = location.coords;
              const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
              const heartRate = bleSensorData
                ? Math.min(190, Math.max(40, Math.round(bleSensorData.heartRate)))
                : undefined;
              const spo2 = bleSensorData
                ? Math.min(100, Math.max(75, Math.round(bleSensorData.spo2)))
                : undefined;

              const patientName = currentUser?.name || 'Patient';
              // Single-part SMS under 160 characters for maximum carrier delivery success
              const message = `EMERGENCY ALERT: ${patientName} triggered SOS.\nHR: ${heartRate ?? '--'} BPM | SpO2: ${spo2 ?? '--'}%\nLocation: ${locationUrl}`;

              // Send the SMS first — it must not depend on the backend being up.
              try {
                await sendAutomaticSms(recipient, message);
                Alert.alert('Alert Sent', `Emergency SMS sent to ${recipient}.`);
              } catch (smsError) {
                console.warn('Emergency SMS sending error:', smsError);
                Alert.alert(
                  'Cellular SMS Failed',
                  `${smsError instanceof Error ? smsError.message : 'Unknown error'}\n\nWould you like to open your messaging app to send it manually?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Open SMS App',
                      onPress: () => openNativeSmsApp(recipient, message),
                    },
                  ],
                );
              }

              fetchData();

              // Record the alert on the server without delaying the SMS confirmation.
              void triggerEmergencyAlert(
                'manual',
                { latitude, longitude },
                heartRate,
                spo2,
                message,
              ).catch((error) => {
                console.warn('Emergency alert could not be recorded:', error);
              });
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to send emergency alert.',
              );
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  const handleRunAutonomousDemo = useCallback(async () => {
    const { sosContactNumber: currentSos, user: currentUser } = useAppStore.getState();
    const recipient =
      currentSos?.trim() ||
      currentUser?.emergencyContacts?.[0]?.phone ||
      contacts[0]?.phone;

    const isDummy =
      !recipient ||
      recipient.includes('555-0124') ||
      recipient.includes('555-0125') ||
      recipient.includes('5550124') ||
      recipient.includes('+1555') ||
      recipient.replace(/[^0-9]/g, '').length < 7;

    if (isDummy) {
      Alert.alert(
        'Set Real Mobile Number',
        'Before running the Autonomous SOS demo, please set a real mobile number so the device SIM card can dispatch the emergency SMS.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Mobile Number', onPress: handleOpenPhoneModal },
        ],
      );
      return;
    }

    setAutoResetSeconds(null);
    setRestoredSource(null);
    setSimulating(true);
    setSimulationProgress(null);
    setSimulationResult(null);
    try {
      const result = await simulateAutonomousSos((progress) => {
        setSimulationProgress(progress);
      });
      fetchData();
      setSimulationResult(result);
      // Start 3-second auto-reset countdown to live / last BLE vitals
      setAutoResetSeconds(3);
    } catch (err) {
      Alert.alert(
        'Simulation Notice',
        err instanceof Error ? err.message : 'Failed to execute autonomous simulation.',
      );
    } finally {
      setSimulating(false);
    }
  }, [fetchData, contacts]);

  // Automatic countdown & reset to live BLE or last known BLE vitals
  useEffect(() => {
    if (autoResetSeconds === null) return;
    if (autoResetSeconds > 0) {
      const timer = setTimeout(() => {
        setAutoResetSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (autoResetSeconds === 0) {
      void (async () => {
        setResettingVitals(true);
        try {
          const resetInfo = await resetToLiveBleVitals();
          setRestoredSource(resetInfo.source);
          fetchData();
        } catch (err) {
          console.warn('Auto-reset vitals error:', err);
        } finally {
          setResettingVitals(false);
          setAutoResetSeconds(null);
        }
      })();
    }
  }, [autoResetSeconds, fetchData]);

  // Safety cleanup: If leaving screen with simulated vitals active, ensure auto-reset
  useEffect(() => {
    return () => {
      const current = useAppStore.getState().currentSensorData;
      if (current && current.heartRate > 110) {
        void resetToLiveBleVitals();
      }
    };
  }, []);

  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current && !loading) {
      hasAutoStartedRef.current = true;
      void handleRunAutonomousDemo();
    }
  }, [autoStart, loading, handleRunAutonomousDemo]);

  const handleResetVitals = async () => {
    setAutoResetSeconds(null);
    setResettingVitals(true);
    try {
      const resetInfo = await resetToLiveBleVitals();
      setRestoredSource(resetInfo.source);
      fetchData();
    } catch (err) {
      Alert.alert(
        'Reset Failed',
        err instanceof Error ? err.message : 'Could not reset vitals.',
      );
    } finally {
      setResettingVitals(false);
    }
  };

  const handleAddContact = async () => {
    const result = emergencyContactSchema.safeParse(contactForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errors[String(issue.path[0])] = issue.message;
      });
      setContactErrors(errors);
      return;
    }
    try {
      await addEmergencyContact(result.data);
      setModalVisible(false);
      setContactForm({ name: '', phone: '', relationship: '' });
      setContactErrors({});
      fetchData();
    } catch {
      Alert.alert('Error', 'Failed to add contact.');
    }
  };

  const handleRemoveContact = (contact: EmergencyContact) => {
    Alert.alert('Remove Contact', `Remove ${contact.name} from emergency contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeEmergencyContact(contact.id);
            fetchData();
          } catch {
            Alert.alert('Error', 'Failed to remove contact.');
          }
        },
      },
    ]);
  };

  if (loading) return <Loader message="Loading emergency info..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const activeAlerts = emergencyAlerts.filter((a) => a.status === 'active');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader icon="alert-decagram" title="Emergency" subtitle="SOS & Alert Management" tint={Colors.destructive} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
      >
        {smsPermissionGranted === false && (
          <Card style={styles.permissionCard}>
            <View style={styles.permissionRow}>
              <MaterialCommunityIcons name="message-alert" size={26} color={Colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>SMS Permission Required</Text>
                <Text style={styles.permissionText}>
                  Android requires permission to send emergency SMS alerts to your contacts during a critical cardiac event.
                </Text>
              </View>
            </View>
            <View style={styles.permissionButtonsRow}>
              <TouchableOpacity
                style={styles.permissionGrantBtn}
                onPress={async () => {
                  const granted = await requestSmsPermission();
                  setSmsPermissionGranted(granted);
                  if (!granted) {
                    Alert.alert(
                      'SMS Permission Needed',
                      'Android blocked the permission prompt. Please enable SMS in Phone Settings -> Apps -> Cardiac Monitor -> Permissions.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Settings', onPress: openAppSettings },
                      ],
                    );
                  }
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check-circle" size={16} color={Colors.onPrimary} />
                <Text style={styles.permissionGrantText}>Allow SMS Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionSettingsBtn}
                onPress={openAppSettings}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="cog" size={16} color={Colors.textSecondary} />
                <Text style={styles.permissionSettingsText}>Settings</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Quick Emergency SMS Recipient Card */}
        <Card elevated style={styles.recipientCard}>
          <View style={styles.recipientRow}>
            <View
              style={[
                styles.recipientIconCircle,
                isDummyRecipient && styles.recipientIconCircleWarning,
              ]}
            >
              <MaterialCommunityIcons
                name={isDummyRecipient ? 'phone-alert' : 'phone-check'}
                size={22}
                color={isDummyRecipient ? Colors.warning : Colors.status.healthy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recipientTitle}>Emergency SMS Recipient</Text>
              <Text
                style={[
                  styles.recipientNumber,
                  isDummyRecipient && styles.recipientNumberWarning,
                ]}
              >
                {rawRecipient || 'No mobile number set'}
              </Text>
              {isDummyRecipient && (
                <Text style={styles.recipientWarning}>
                  ⚠️ Dummy / unconfigured number. Please set your real mobile.
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.recipientChangeBtn}
              onPress={handleOpenPhoneModal}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={isDummyRecipient ? 'plus-circle' : 'pencil'}
                size={14}
                color={Colors.primary}
              />
              <Text style={styles.recipientChangeText}>
                {isDummyRecipient ? 'Set' : 'Change'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <TouchableOpacity
          style={[styles.sosButton, sending && styles.sosButtonDisabled]}
          onPress={handleSOS}
          disabled={sending}
          activeOpacity={0.85}
        >
          <GradientView
            colors={['#DC2626', '#991B1B']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <MaterialCommunityIcons name="alert-octagon" size={48} color={Colors.onPrimary} />
          <Text style={styles.sosText}>{sending ? 'SENDING...' : 'SOS'}</Text>
          <Text style={styles.sosSubtext}>Tap to send emergency alert</Text>
        </TouchableOpacity>

        {/* Autonomous SOS Demo Simulation Card */}
        <Card elevated style={styles.simCard}>
          <View style={styles.simCardHeader}>
            <View style={styles.simTitleRow}>
              <MaterialCommunityIcons name="shield-alert" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.simCardTitle}>Autonomous SOS Demo</Text>
                <Text style={styles.simCardSubtitle}>Autonomous ML Risk & Emergency SIM SMS</Text>
              </View>
            </View>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>AUTONOMOUS</Text>
            </View>
          </View>

          <Text style={styles.simDescription}>
            Continuously evaluates cardiac stress stages (148→168 BPM, SpO2 88→85%), queries real-time ML risk inference, and autonomously triggers high-accuracy GPS SMS dispatch and cloud database logging with 0 manual intervention.
          </Text>

          {simulating && simulationProgress && (
            <View style={styles.simProgressBox}>
              <View style={styles.simProgressRow}>
                <Text style={styles.simProgressStep}>
                  Stage {simulationProgress.step} of {simulationProgress.totalSteps}
                </Text>
                <Text style={styles.simVitalsBadge}>
                  {simulationProgress.heartRate} BPM · {simulationProgress.spo2}% SpO2
                </Text>
              </View>
              <Text style={styles.simStatusText}>{simulationProgress.statusText}</Text>
              <View style={styles.simProgressBarBg}>
                <View
                  style={[
                    styles.simProgressBarFill,
                    { width: `${(simulationProgress.step / simulationProgress.totalSteps) * 100}%` },
                  ]}
                />
              </View>
            </View>
          )}

          {simulationResult && (
            <View style={styles.simSuccessBox}>
              <View style={styles.simSuccessHeader}>
                <MaterialCommunityIcons name="check-decagram" size={24} color={Colors.status.healthy} />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={styles.simSuccessTitle}>Autonomous SOS Dispatched!</Text>
                  <Text style={styles.simSuccessSubtitle}>
                    Emergency SMS delivered to {simulationResult.recipient}
                  </Text>
                </View>
              </View>

              <View style={styles.simSuccessDetails}>
                <View style={styles.simSuccessItem}>
                  <Text style={styles.simSuccessItemLabel}>Critical HR</Text>
                  <Text style={[styles.simSuccessItemValue, { color: Colors.destructive }]}>
                    {simulationResult.heartRate} BPM
                  </Text>
                </View>
                <View style={styles.simSuccessItem}>
                  <Text style={styles.simSuccessItemLabel}>SpO2</Text>
                  <Text style={[styles.simSuccessItemValue, { color: Colors.destructive }]}>
                    {simulationResult.spo2}%
                  </Text>
                </View>
                <View style={styles.simSuccessItem}>
                  <Text style={styles.simSuccessItemLabel}>ML Risk</Text>
                  <Text style={[styles.simSuccessItemValue, { color: Colors.destructive }]}>
                    {simulationResult.riskScore}/100
                  </Text>
                </View>
                <View style={styles.simSuccessItem}>
                  <Text style={styles.simSuccessItemLabel}>PostgreSQL</Text>
                  <Text style={[styles.simSuccessItemValue, { color: Colors.status.healthy }]}>
                    Recorded
                  </Text>
                </View>
              </View>

              {autoResetSeconds !== null && autoResetSeconds > 0 ? (
                <View style={styles.autoResetBanner}>
                  <MaterialCommunityIcons name="timer-sand" size={16} color={Colors.primary} />
                  <Text style={styles.autoResetText}>
                    Auto-resetting to {bleStatus === 'connected' ? 'live watch BLE' : 'last BLE values'} in {autoResetSeconds}s...
                  </Text>
                  <TouchableOpacity
                    style={styles.resetNowBtn}
                    onPress={handleResetVitals}
                    disabled={resettingVitals}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.resetNowText}>
                      {resettingVitals ? 'Resetting...' : 'Reset Now'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : restoredSource ? (
                <View style={styles.autoResetDoneBanner}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={Colors.status.healthy} />
                  <Text style={styles.autoResetDoneText}>
                    {restoredSource === 'live_ble'
                      ? `Vitals auto-restored to live BLE stream (${currentSensorData?.heartRate ?? 72} BPM)`
                      : restoredSource === 'last_ble'
                      ? `Vitals auto-restored to last BLE values (${currentSensorData?.heartRate ?? 72} BPM)`
                      : `Vitals auto-restored to normal baseline (${currentSensorData?.heartRate ?? 72} BPM)`}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.simResetNormalBtn}
                  onPress={handleResetVitals}
                  activeOpacity={0.8}
                  disabled={resettingVitals}
                >
                  <MaterialCommunityIcons name="restore" size={16} color="#FFFFFF" />
                  <Text style={styles.simResetNormalText}>
                    {resettingVitals ? 'Resetting...' : 'Reset Vitals to Live / Normal'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.simActionsRow}>
            <TouchableOpacity
              style={[
                styles.simButton,
                { flex: 1 },
                (simulating || sending || resettingVitals) && styles.simButtonDisabled,
              ]}
              onPress={handleRunAutonomousDemo}
              disabled={simulating || sending || resettingVitals}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={simulating ? 'loading' : 'play-circle'}
                size={18}
                color={Colors.onPrimary}
              />
              <Text style={styles.simButtonText}>
                {simulating
                  ? `Autonomous SOS in Progress (${simulationProgress ? simulationProgress.step : 1}/3)...`
                  : simulationResult
                  ? 'Re-run Autonomous SOS Demo'
                  : 'Run Autonomous SOS Demo'}
              </Text>
            </TouchableOpacity>

            {!simulationResult && (
              <TouchableOpacity
                style={[
                  styles.simResetBtn,
                  (simulating || sending || resettingVitals) && styles.simButtonDisabled,
                ]}
                onPress={handleResetVitals}
                disabled={simulating || sending || resettingVitals}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={resettingVitals ? 'loading' : 'restore'}
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.simResetBtnText}>
                  {resettingVitals ? 'Resetting...' : 'Reset Normal'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {activeAlerts.length > 0 && (
          <Card elevated>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="alert" size={20} color={Colors.destructive} />
              <Text style={styles.sectionTitle}>Active Alerts ({activeAlerts.length})</Text>
            </View>
            {activeAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertRow}>
                <View style={styles.alertDot} />
                <View style={styles.alertInfo}>
                  <Text style={styles.alertType}>{alert.type.replace('_', ' ').toUpperCase()}</Text>
                  <Text style={styles.alertTime}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        <Card elevated>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="account-group" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setModalVisible(true)}
            >
              <MaterialCommunityIcons name="plus" size={20} color={Colors.onPrimary} />
            </TouchableOpacity>
          </View>
          {contacts.length === 0 ? (
            <TouchableOpacity
              style={styles.contactPlaceholder}
              onPress={() => setModalVisible(true)}
            >
              <MaterialCommunityIcons name="plus-circle" size={32} color={Colors.textSecondary} />
              <Text style={styles.contactPlaceholderText}>Add an emergency contact</Text>
            </TouchableOpacity>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactInitial}>
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactDetail}>
                    {contact.phone} · {contact.relationship}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveContact(contact)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="close-circle" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={styles.infoTitle}>What happens when you trigger an alert?</Text>
          {[
            'Your GPS location is captured',
            'Emergency contacts are notified via SMS',
            'Alert is logged in the system',
          ].map((step, i) => (
            <View key={i} style={styles.infoStep}>
              <Text style={styles.infoNumber}>{i + 1}</Text>
              <Text style={styles.infoText}>{step}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Emergency Contact</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[styles.input, contactErrors.name && styles.inputError]}
                placeholder="Contact's full name"
                placeholderTextColor={Colors.textSecondary}
                value={contactForm.name}
                onChangeText={(v) => {
                  setContactForm((p) => ({ ...p, name: v }));
                  setContactErrors((p) => ({ ...p, name: undefined }));
                }}
              />
              {contactErrors.name && <Text style={styles.fieldError}>{contactErrors.name}</Text>}

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, contactErrors.phone && styles.inputError]}
                placeholder="+1-555-0123"
                placeholderTextColor={Colors.textSecondary}
                value={contactForm.phone}
                onChangeText={(v) => {
                  setContactForm((p) => ({ ...p, phone: v }));
                  setContactErrors((p) => ({ ...p, phone: undefined }));
                }}
                keyboardType="phone-pad"
              />
              {contactErrors.phone && <Text style={styles.fieldError}>{contactErrors.phone}</Text>}

              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={[styles.input, contactErrors.relationship && styles.inputError]}
                placeholder="e.g. Spouse, Physician"
                placeholderTextColor={Colors.textSecondary}
                value={contactForm.relationship}
                onChangeText={(v) => {
                  setContactForm((p) => ({ ...p, relationship: v }));
                  setContactErrors((p) => ({ ...p, relationship: undefined }));
                }}
              />
              {contactErrors.relationship && (
                <Text style={styles.fieldError}>{contactErrors.relationship}</Text>
              )}

              <TouchableOpacity style={styles.saveButton} onPress={handleAddContact}>
                <Text style={styles.saveButtonText}>Save Contact</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quick Set Emergency Recipient Modal */}
      <Modal visible={phoneModalVisible} transparent animationType="fade">
        <View style={styles.quickModalOverlay}>
          <View style={styles.quickModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <MaterialCommunityIcons name="cellphone-message" size={24} color={Colors.primary} />
                <Text style={styles.modalTitle}>Set Emergency Mobile</Text>
              </View>
              <TouchableOpacity onPress={() => setPhoneModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.quickModalDesc}>
              Enter a real 10-digit mobile number with country code (e.g. +91 9876543210). Your phone's SIM will send direct emergency SMS alerts with GPS to this number.
            </Text>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={[styles.input, phoneError ? styles.inputError : null]}
              placeholder="+919876543210"
              placeholderTextColor={Colors.textSecondary}
              value={quickPhoneInput}
              onChangeText={(v) => {
                setQuickPhoneInput(v);
                setPhoneError(null);
              }}
              keyboardType="phone-pad"
              autoFocus
            />
            {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1, backgroundColor: Colors.border, marginTop: 0 }]}
                onPress={() => setPhoneModalVisible(false)}
              >
                <Text style={[styles.saveButtonText, { color: Colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 2, marginTop: 0 }]}
                onPress={handleSaveQuickPhone}
              >
                <Text style={styles.saveButtonText}>Save Recipient</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg },
  sosButton: {
    backgroundColor: Colors.destructive,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.lg,
  },
  sosButtonDisabled: { opacity: 0.7 },
  sosText: { fontSize: 40, fontWeight: '800', color: Colors.onPrimary, letterSpacing: 4, marginTop: Spacing.sm },
  sosSubtext: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, flex: 1 },
  addButton: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.destructive, marginRight: Spacing.sm },
  alertInfo: { flex: 1 },
  alertType: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  alertTime: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  contactPlaceholder: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  contactPlaceholderText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  contactAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  contactInitial: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  contactInfo: { flex: 1 },
  contactName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  contactDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  infoTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },
  infoStep: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  infoNumber: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary + '18',
    color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'center', lineHeight: 24, overflow: 'hidden',
  },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md, color: Colors.text,
  },
  inputError: { borderColor: Colors.destructive },
  fieldError: { color: Colors.destructive, fontSize: FontSize.xs, marginTop: Spacing.xs },
  saveButton: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md,
    alignItems: 'center', marginTop: Spacing.lg, ...Shadow.md,
  },
  saveButtonText: { color: Colors.onPrimary, fontSize: FontSize.md, fontWeight: '600' },
  simCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    backgroundColor: Colors.surface,
  },
  simCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  simTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  simCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  simCardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  demoBadge: {
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '35',
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  simDescription: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginVertical: Spacing.sm,
  },
  simProgressBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  simProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simProgressStep: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  simVitalsBadge: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.destructive,
  },
  simStatusText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    marginVertical: Spacing.xs,
  },
  simProgressBarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  simProgressBarFill: {
    height: '100%',
    backgroundColor: Colors.destructive,
    borderRadius: 3,
  },
  simButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  simButtonDisabled: {
    opacity: 0.6,
  },
  simButtonText: {
    color: Colors.onPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  simActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  simResetBtn: {
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  simResetBtnText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  permissionCard: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning + '50',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  permissionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  permissionText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  permissionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  permissionGrantBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  permissionGrantText: {
    color: Colors.onPrimary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  permissionSettingsBtn: {
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  permissionSettingsText: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  simSuccessBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.status.healthy + '50',
  },
  simSuccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  simSuccessTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.status.healthy,
  },
  simSuccessSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  simSuccessDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  simSuccessItem: {
    alignItems: 'center',
    flex: 1,
  },
  simSuccessItemLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  simSuccessItemValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  simResetNormalBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  simResetNormalText: {
    color: Colors.onPrimary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  autoResetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '35',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  autoResetText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  resetNowBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  resetNowText: {
    color: Colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  autoResetDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.healthy + '18',
    borderWidth: 1,
    borderColor: Colors.status.healthy + '35',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  autoResetDoneText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.status.healthy,
    fontWeight: '700',
  },
  recipientCard: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recipientIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.status.healthy + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientIconCircleWarning: {
    backgroundColor: Colors.warning + '20',
  },
  recipientTitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipientNumber: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 1,
  },
  recipientNumberWarning: {
    color: Colors.warning,
  },
  recipientWarning: {
    fontSize: 11,
    color: Colors.warning,
    marginTop: 2,
    fontWeight: '500',
  },
  recipientChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '35',
  },
  recipientChangeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  quickModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  quickModalContent: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...Shadow.lg,
  },
  quickModalDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
});

export default EmergencyScreen;
