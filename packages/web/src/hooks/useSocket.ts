import { useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.js';
import { useDemoStore } from '../stores/demo.js';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

let socket: Socket | null = null;

function getSocket(): Socket | null {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return null;

  if (!socket || socket.disconnected) {
    socket = io(`${API_URL}/fleet`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to /fleet namespace');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
      // If auth fails, token might be expired — try to reconnect with new token
      const { accessToken: currentToken } = useAuthStore.getState();
      if (currentToken && socket) {
        socket.auth = { token: currentToken };
      }
    });
  }

  return socket;
}

/**
 * Hook that returns a singleton Socket.IO client connected to the fleet namespace.
 * Auto-connects when the component mounts and the user is authenticated.
 */
export function useSocket(): Socket | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isDemoMode = useDemoStore((s) => s.isDemoMode);

  // Derive the socket value synchronously — getSocket() is idempotent for the same token
  // Skip WebSocket connection entirely in demo mode (fake token would cause reconnect spam)
  const currentSocket = useMemo(() => {
    if (!accessToken || isDemoMode) return null;
    return getSocket();
  }, [accessToken, isDemoMode]);

  // Handle side effects: disconnect on logout
  useEffect(() => {
    if (!accessToken && socket) {
      socket.disconnect();
      socket = null;
    }
  }, [accessToken]);

  return currentSocket;
}
