import apiClient from './client';
import { API_ENDPOINTS } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import type { EmergencyAlert, EmergencyContact, GeoLocation } from '../../types';

function getUserId(): string {
  return useAppStore.getState().user?.id ?? 'USER_00001';
}

export async function getEmergencyAlerts(): Promise<EmergencyAlert[]> {
  try {
    const response = await apiClient.get(API_ENDPOINTS.EMERGENCY_ALERTS(getUserId()));
    const rawList = response.data;
    if (Array.isArray(rawList)) {
      return rawList.map((a: any) => ({
        id: String(a.id),
        userId: a.user_id,
        type: (a.alert_type as EmergencyAlert['type']) || 'high_risk',
        location: {
          latitude: a.latitude ?? 0,
          longitude: a.longitude ?? 0,
        },
        timestamp: a.created_at || new Date().toISOString(),
        status: a.status || 'active',
      }));
    }
  } catch {
    // Offline: show no alerts rather than fabricated ones.
  }
  return [];
}

export async function triggerEmergencyAlert(
  type: EmergencyAlert['type'],
  location: GeoLocation,
  heartRate?: number,
  spo2?: number,
  message?: string,
): Promise<EmergencyAlert> {
  const response = await apiClient.post(API_ENDPOINTS.EMERGENCY, {
    user_id: getUserId(),
    latitude: location.latitude,
    longitude: location.longitude,
    heart_rate: heartRate ?? null,
    spo2: spo2 ?? null,
    message: message ?? `Manual ${type} alert`,
  });
  const d = response.data;
  return {
    id: String(d.id),
    userId: getUserId(),
    type,
    location,
    timestamp: new Date().toISOString(),
    status: d.status ?? 'active',
  };
}

export async function resolveEmergencyAlert(alertId: string): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.EMERGENCY_RESOLVE(alertId));
  } catch {
    // Offline resolution fallback
  }
}

export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  try {
    const response = await apiClient.get(API_ENDPOINTS.EMERGENCY_CONTACTS(getUserId()));
    const raw = response.data;
    if (Array.isArray(raw)) {
      return raw.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
      }));
    }
  } catch {
    // Offline: return no contacts rather than fabricated ones.
  }
  return [];
}

export async function addEmergencyContact(
  contact: Omit<EmergencyContact, 'id'>,
): Promise<EmergencyContact> {
  const response = await apiClient.post(API_ENDPOINTS.EMERGENCY_ADD_CONTACT, {
    user_id: getUserId(),
    name: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    is_primary: false,
  });
  const d = response.data;
  return {
    id: String(d.id),
    name: d.name,
    relationship: d.relationship,
    phone: d.phone,
  };
}

export async function removeEmergencyContact(contactId: string): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.EMERGENCY_DELETE_CONTACT(contactId));
}
