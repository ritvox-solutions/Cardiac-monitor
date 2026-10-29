import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AppProvider, useAppContext } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/common';
import { PaperThemeLight, PaperThemeDark } from './src/theme';
import { USE_MOCK_DATA } from './src/constants';
import { mockSensorService } from './src/services/mock/mockSensorService';

const ThemedApp: React.FC = () => {
  const { isDarkMode } = useAppContext();

  React.useEffect(() => {
    if (USE_MOCK_DATA) {
      mockSensorService.start();
    }
    return () => mockSensorService.stop();
  }, []);

  return (
    <PaperProvider theme={isDarkMode ? PaperThemeDark : PaperThemeLight}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <AppNavigator />
    </PaperProvider>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <ThemedApp />
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
