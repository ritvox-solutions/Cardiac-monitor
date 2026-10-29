export function formatHeartRate(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

export function formatSpO2(percent: number): string {
  return `${Math.round(percent)}%`;
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme';

/**
 * Get risk color for a given level.
 * Uses the fixed status palette from theme (healthy/moderate/high/critical).
 */
export function getRiskColor(level: string): string {
  const normalized = level.toLowerCase();
  switch (normalized) {
    case 'healthy':
    case 'low':
      return Colors.status.healthy;
    case 'moderate':
    case 'medium':
      return Colors.status.moderate;
    case 'high':
      return Colors.status.high;
    case 'critical':
      return Colors.status.critical;
    default:
      return Colors.textTertiary;
  }
}

/**
 * Get human-readable label for risk level.
 */
export function getRiskLabel(level: string): string {
  const normalized = level.toLowerCase();
  switch (normalized) {
    case 'healthy':
    case 'low':
      return 'Healthy';
    case 'moderate':
    case 'medium':
      return 'Moderate';
    case 'high':
      return 'High';
    case 'critical':
      return 'Critical';
    default:
      return 'Unknown';
  }
}

/**
 * Get icon for risk level.
 * Every risk-level UI pairs the color with an icon (never color alone).
 */
export function getRiskIcon(level: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const normalized = level.toLowerCase();
  switch (normalized) {
    case 'healthy':
    case 'low':
      return 'check-circle';
    case 'moderate':
    case 'medium':
      return 'alert-circle';
    case 'high':
      return 'alert';
    case 'critical':
      return 'alert-octagon';
    default:
      return 'help-circle';
  }
}

/**
 * Get DCSI tier from score (0-100).
 */
export function getDcsiTier(score: number): 'healthy' | 'moderate' | 'high' | 'critical' {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped <= 30) return 'healthy';
  if (clamped <= 60) return 'moderate';
  if (clamped <= 80) return 'high';
  return 'critical';
}

/**
 * Get color for DCSI score.
 */
export function getDcsiColor(score: number): string {
  return getRiskColor(getDcsiTier(score));
}

/**
 * Get color for heart rate value.
 */
export function getHeartRateColor(bpm: number): string {
  if (bpm < 50 || bpm > 120) return Colors.destructive;
  if (bpm < 60 || bpm > 100) return Colors.warning;
  return Colors.status.healthy;
}

/**
 * Get color for SpO2 value.
 */
export function getSpO2Color(spo2: number): string {
  if (spo2 < 90) return Colors.destructive;
  if (spo2 < 95) return Colors.warning;
  return Colors.status.healthy;
}

/**
 * Get color for HRV value (higher is better).
 */
export function getHrvColor(hrv: number): string {
  if (hrv < 20) return Colors.destructive;
  if (hrv < 50) return Colors.warning;
  return Colors.status.healthy;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generate a random ID.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Debounce function.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format number with specific decimal places.
 */
export function formatNumber(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

/**
 * Calculate percentage.
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return clamp((value / total) * 100, 0, 100);
}