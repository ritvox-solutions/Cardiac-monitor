import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useAppStore } from '../store/useAppStore';
import { usePrediction } from '../hooks/usePrediction';
import { ErrorBoundary } from '../components/common';
import { Colors } from '../theme';
import SplashScreen from '../screens/Splash';
import LoginScreen from '../screens/Auth/Login';
import RegisterScreen from '../screens/Auth/Register';
import DashboardScreen from '../screens/Dashboard';
import LiveMonitoringScreen from '../screens/LiveMonitoring';
import PredictionScreen from '../screens/Prediction';
import HistoryScreen from '../screens/History';
import EmergencyScreen from '../screens/Emergency';
import SettingsScreen from '../screens/Settings';
import HealthProfileScreen from '../screens/HealthProfile';
import OnboardingScreen from '../screens/Onboarding';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  Emergency: { alertId?: string; autoStart?: boolean } | undefined;
  HealthProfile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  LiveMonitoring: undefined;
  Prediction: undefined;
  History: undefined;
  Emergency: { alertId?: string; autoStart?: boolean } | undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Dashboard: 'view-dashboard',
  LiveMonitoring: 'heart-pulse',
  Prediction: 'chart-line',
  History: 'history',
  Emergency: 'alert-decagram',
  Settings: 'cog',
};

// Isolate each tab so a render error on one screen shows a recoverable message
// there instead of blanking the whole app (the tab bar stays usable).
function withScreenBoundary<P extends object>(Screen: React.ComponentType<P>): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <ErrorBoundary>
      <Screen {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withScreenBoundary(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return Wrapped;
}

const DashboardWithBoundary = withScreenBoundary(DashboardScreen);
const LiveMonitoringWithBoundary = withScreenBoundary(LiveMonitoringScreen);
const PredictionWithBoundary = withScreenBoundary(PredictionScreen);
const HistoryWithBoundary = withScreenBoundary(HistoryScreen);
const EmergencyWithBoundary = withScreenBoundary(EmergencyScreen);
const SettingsWithBoundary = withScreenBoundary(SettingsScreen);

const AuthNavigator: React.FC = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

const MainTabs: React.FC = () => {
  // Runs the BLE -> store bridge and the backend /predict loop for the whole
  // authenticated session, independent of which tab is focused.
  usePrediction();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={TAB_ICONS[route.name]} size={size - 2} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardWithBoundary} />
      <Tab.Screen name="LiveMonitoring" component={LiveMonitoringWithBoundary} />
      <Tab.Screen name="Prediction" component={PredictionWithBoundary} />
      <Tab.Screen name="History" component={HistoryWithBoundary} />
      <Tab.Screen
        name="Emergency"
        component={EmergencyWithBoundary}
        options={{
          tabBarActiveTintColor: Colors.destructive,
        }}
      />
      <Tab.Screen name="Settings" component={SettingsWithBoundary} />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { isDarkMode } = useAppContext();

  const navigationTheme = useMemo(
    () =>
      isDarkMode
        ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              primary: Colors.primaryLight,
              background: '#0F172A',
              card: '#111827',
              text: '#F1F5F9',
              border: '#1E293B',
            },
          }
        : {
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              primary: Colors.primary,
              background: Colors.background,
              card: Colors.surface,
              text: Colors.text,
              border: Colors.divider,
            },
          },
    [isDarkMode],
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Splash" component={SplashScreen} />
        <RootStack.Screen name="Auth" component={AuthNavigator} />
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        <RootStack.Screen name="MainTabs" component={MainTabs} />
        <RootStack.Screen name="Emergency" component={EmergencyScreen} />
        <RootStack.Screen name="HealthProfile" component={HealthProfileScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
