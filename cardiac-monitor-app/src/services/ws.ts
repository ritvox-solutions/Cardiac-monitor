import { useAppStore } from '../store/useAppStore';
import type { SensorData, Prediction, EmergencyAlert } from '../types';

type WsMessage =
  | { type: 'sensor_data'; payload: SensorData }
  | { type: 'prediction'; payload: Prediction }
  | { type: 'emergency_alert'; payload: EmergencyAlert }
  | { type: 'connection_status'; payload: { status: 'connected' | 'disconnected' } };

type WsCallback = (message: WsMessage) => void;

const RECONNECT_DELAY = 3000;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<WsCallback> = new Set();
  private shouldReconnect = false;

  connect(baseUrl: string): void {
    this.url = baseUrl.replace(/^http/, 'ws') + '/ws';
    this.shouldReconnect = true;
    this.createConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(callback: WsCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private createConnection(): void {
    if (!this.url) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.broadcast({ type: 'connection_status', payload: { status: 'connected' } });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch {
        // Ignore invalid message payloads
      }
    };

    this.ws.onclose = () => {
      this.broadcast({ type: 'connection_status', payload: { status: 'disconnected' } });
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.createConnection(), RECONNECT_DELAY);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private handleMessage(message: WsMessage): void {
    const store = useAppStore.getState();

    switch (message.type) {
      case 'sensor_data':
        store.setCurrentSensorData(message.payload);
        break;
      case 'prediction':
        store.setCurrentPrediction(message.payload);
        break;
      case 'emergency_alert':
        store.setEmergencyAlerts([message.payload, ...store.emergencyAlerts]);
        break;
    }

    this.broadcast(message);
  }

  private broadcast(message: WsMessage): void {
    this.listeners.forEach((cb) => cb(message));
  }
}

export const wsService = new WebSocketService();
