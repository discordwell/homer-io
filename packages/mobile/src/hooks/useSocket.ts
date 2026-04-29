import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL, WS_NAMESPACE } from '@/constants';
import { getTokens } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

let socketInstance: Socket | null = null;

export function useSocket(): Socket | null {
  // The connected socket lives in state (not a ref) so consumers re-render
  // when it becomes available — the previous ref-based version returned a
  // stale null on the render after connect.
  const [socket, setSocket] = useState<Socket | null>(null);
  const { isAuthenticated } = useAuthStore();

  // Drop the cached socket as soon as we lose auth — adjust state during render
  // so the effect body itself doesn't have to call setState synchronously.
  const [seenAuth, setSeenAuth] = useState(isAuthenticated);
  if (seenAuth !== isAuthenticated) {
    setSeenAuth(isAuthenticated);
    if (!isAuthenticated && socket) setSocket(null);
  }

  useEffect(() => {
    if (!isAuthenticated) {
      socketInstance?.disconnect();
      socketInstance = null;
      return;
    }

    let cancelled = false;
    (async () => {
      if (socketInstance?.connected) {
        if (!cancelled) setSocket(socketInstance);
        return;
      }

      const { accessToken } = await getTokens();
      if (!accessToken || cancelled) return;

      const newSocket = io(`${WS_URL}${WS_NAMESPACE}`, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      newSocket.on('connect', () => {
        console.log('[Socket] Connected');
      });

      newSocket.on('connect_error', async (err) => {
        console.warn('[Socket] Connection error:', err.message);
        // Try refreshing token
        const { accessToken: newToken } = await getTokens();
        if (newToken) {
          newSocket.auth = { token: newToken };
        }
      });

      socketInstance = newSocket;
      if (!cancelled) setSocket(newSocket);
    })();

    return () => {
      cancelled = true;
      socketInstance?.disconnect();
      socketInstance = null;
      setSocket(null);
    };
  }, [isAuthenticated]);

  return socket;
}
