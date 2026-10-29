import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { mockApi } from '../services/mock';
import { updateHealthProfile as syncHealthProfile } from '../services/api/auth';
import type { LoginForm, RegisterForm } from '../utils/validation';
import type { HealthProfile } from '../types';

// Session state (user/token/isAuthenticated) is persisted automatically by
// the zustand `persist` middleware in useAppStore — every setUser/setToken
// call here is written to AsyncStorage and rehydrated on the next launch, so
// there is no separate manual storage step (or "restore session" step) here.

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const response = await mockApi.auth.login(data);
      // The mock backend has no real account system — every credential pair
      // resolves to the same demo user. Keep whatever profile is already
      // persisted for that user instead of overwriting it with the mock's
      // fresh (profile-less) copy.
      const existing = useAppStore.getState().user;
      const user = existing && existing.id === response.user.id ? existing : response.user;

      useAppStore.getState().setUser(user);
      useAppStore.getState().setToken(response.token);
      useAppStore.getState().setAuthenticated(true);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterForm) => {
    setLoading(true);
    setError(null);
    try {
      const response = await mockApi.auth.register({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      useAppStore.getState().setUser(response.user);
      useAppStore.getState().setToken(response.token);
      useAppStore.getState().setAuthenticated(true);
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateHealthProfile = useCallback(async (profile: HealthProfile): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const user = await syncHealthProfile(profile);
      useAppStore.getState().setUser(user);
      return true;
    } catch {
      setError('Failed to save health profile. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    useAppStore.getState().logout();
  }, []);

  return { login, register, logout, updateHealthProfile, loading, error };
}
