import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getStoredToken } from '../auth/storage';
import { WS_URL } from '../config/env';

export type WSEvent =
  | { type: 'incident-triggered'; incidentId: string }
  | { type: 'incident-resolved' }
  | { type: 'acknowledgment-received' }
  | { type: 'help-request-received' }
  | { type: 'person-marked-safe' };

interface WebSocketState {
  connected: boolean;
  lastEvent: WSEvent | null;
  allClearReceived: boolean;
}

interface WebSocketContextValue extends WebSocketState {
  dismissAllClear: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [allClearReceived, setAllClearReceived] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      const token = await getStoredToken();
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type: string; incidentId?: string };
        if (data.type === 'incident-triggered' && data.incidentId) {
          setLastEvent({ type: 'incident-triggered', incidentId: data.incidentId });
        } else if (data.type === 'incident-resolved') {
          setLastEvent({ type: 'incident-resolved' });
          setAllClearReceived(true);
        } else if (data.type === 'acknowledgment-received') {
          setLastEvent({ type: 'acknowledgment-received' });
        } else if (data.type === 'help-request-received') {
          setLastEvent({ type: 'help-request-received' });
        } else if (data.type === 'person-marked-safe') {
          setLastEvent({ type: 'person-marked-safe' });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(() => connect(), 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setConnected(false);
      }
      return;
    }
    getStoredToken().then((token) => {
      if (token) connect();
    });
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, connect]);

  const dismissAllClear = useCallback(() => {
    setAllClearReceived(false);
  }, []);

  const value: WebSocketContextValue = {
    connected,
    lastEvent,
    allClearReceived,
    dismissAllClear,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) return { connected: false, lastEvent: null, allClearReceived: false, dismissAllClear: () => {} };
  return ctx;
}
