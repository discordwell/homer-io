import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL, WS_NAMESPACE } from '@/constants';
import { getTokens } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

let socketInstance: Socket | null = null;

export function useSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      socketInstance?.disconnect();
      socketInstance = null;
      socketRef.current = null;
      return;
    }

    if (socketInstance?.connected) {
      socketRef.current = socketInstance;
      return;
    }

    (async () => {
      const { accessToken } = await getTokens();
      if (!accessToken) return;

      const socket = io(`${WS_URL}${WS_NAMESPACE}`, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      socket.on('connect', () => {
        console.log('[Socket] Connected');
      });

      socket.on('connect_error', async (err) => {
        console.warn('[Socket] Connection error:', err.message);
        // Try refreshing token
        const { accessToken: newToken } = await getTokens();
        if (newToken) {
          socket.auth = { token: newToken };
        }
      });

      socketInstance = socket;
      socketRef.current = socket;
    })();

    return () => {
      socketInstance?.disconnect();
      socketInstance = null;
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  return socketRef.current;
}
