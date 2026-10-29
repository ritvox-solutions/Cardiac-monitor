import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import type { GeoLocation } from '../types';

interface UseLocationReturn {
  location: GeoLocation | null;
  error: string | null;
  loading: boolean;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<GeoLocation | null>;
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'Please enable location access in your device settings to use emergency features.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      setError('Location permission denied');
      return false;
    }
    return true;
  };

  const refreshLocation = async (): Promise<GeoLocation | null> => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coords);
      setError(null);
      return coords;
    } catch {
      setError('Failed to get current location');
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      const granted = await requestPermission();
      if (granted) {
        await refreshLocation();
      }
      setLoading(false);
    })();
  }, []);

  return { location, error, loading, requestPermission, refreshLocation };
}
