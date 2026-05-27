import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { getStoredToken } from '../auth/storage';
import { connectSocket, disconnectSocket, getSocket, socketOn, socketOff } from './socketInstance';

export type WSEvent =
  | { type: 'incident-triggered'; incidentId: string }
  | { type: 'incident-resolved' }
  | { type: 'acknowledgment-received' }
  | { type: 'help-request-received' }
  | { type: 'person-marked-safe' };

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  connected: boolean;
  lastEvent: WSEvent | null;
  allClearReceived: boolean;
  dismissAllClear: () => void;
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, data?: unknown) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [allClearReceived, setAllClearReceived] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    getStoredToken().then((token) => {
      if (!token) return;

      const s = connectSocket(token);
      setSocket(s);
      setIsConnected(s.connected);

      s.on('connect', () => setIsConnected(true));
      s.on('disconnect', () => setIsConnected(false));

      s.on('incident:activated', (data: { incidentId?: string }) => {
        setLastEvent({ type: 'incident-triggered', incidentId: data?.incidentId ?? '' });
      });
      s.on('incident:resolved', () => {
        setLastEvent({ type: 'incident-resolved' });
        setAllClearReceived(true);
      });
      s.on('presence:ack', () => {
        setLastEvent({ type: 'acknowledgment-received' });
      });
      s.on('presence:help', () => {
        setLastEvent({ type: 'help-request-received' });
      });
    });

    return () => {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated]);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    socketOn(event, callback);
    return () => socketOff(event, callback);
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    getSocket()?.emit(event, data);
  }, []);

  const dismissAllClear = useCallback(() => {
    setAllClearReceived(false);
  }, []);

  const value: WebSocketContextValue = {
    socket,
    isConnected,
    connected: isConnected,
    lastEvent,
    allClearReceived,
    dismissAllClear,
    on,
    emit,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    return {
      socket: null as Socket | null,
      isConnected: false,
      connected: false,
      lastEvent: null as WSEvent | null,
      allClearReceived: false,
      dismissAllClear: () => {},
      on: (_event: string, _cb: (...args: any[]) => void) => () => {},
      emit: () => {},
    };
  }
  return ctx;
}
