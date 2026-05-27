import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';

type Listener = (...args: any[]) => void;

let _socket: Socket | null = null;
const _pending: Array<{ event: string; listener: Listener }> = [];

export function connectSocket(token: string): Socket {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  console.log('[socket] connecting...');

  _socket = io(API_BASE_URL, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    forceNew: true,
    timeout: 10000,
  });

  _socket.on('connect', () => {
    console.log('[socket] connected, id:', _socket?.id);
  });
  _socket.on('disconnect', (reason: string) => {
    console.log('[socket] disconnected, reason:', reason);
  });
  _socket.on('connect_error', (err: Error) => {
    console.log('[socket] connect_error:', err.message, (err as any).cause);
  });

  for (const { event, listener } of _pending) {
    _socket.on(event, listener);
  }
  _pending.length = 0;

  return _socket;
}

export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
  _pending.length = 0;
}

export function getSocket(): Socket | null {
  return _socket;
}

export function socketOn(event: string, listener: Listener): void {
  if (_socket) {
    _socket.on(event, listener);
  } else {
    _pending.push({ event, listener });
  }
}

export function socketOff(event: string, listener: Listener): void {
  _socket?.off(event, listener);
  const idx = _pending.findIndex((p) => p.event === event && p.listener === listener);
  if (idx !== -1) _pending.splice(idx, 1);
}
