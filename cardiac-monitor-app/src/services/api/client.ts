import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAppStore } from '../../store/useAppStore';

const rawUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

const getBaseUrl = (): string => {
  if (Platform.OS !== 'web' && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return rawUrl.replace('localhost', ip).replace('127.0.0.1', ip);
    }
    // In a standalone production APK on a real device, fallback to live backend
    return 'https://cardiac-api-rb8v.vercel.app';
  }
  return rawUrl;
};

const API_URL = getBaseUrl();

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAppStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.message === 'Network Error' && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const currentBase = originalRequest.baseURL || '';
      const fallbackBase = currentBase.includes('vercel.app')
        ? 'http://localhost:8000'
        : 'https://cardiac-api-rb8v.vercel.app';
      originalRequest.baseURL = fallbackBase;
      return apiClient(originalRequest);
    }
    if (error.response?.status === 401) {
      useAppStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
