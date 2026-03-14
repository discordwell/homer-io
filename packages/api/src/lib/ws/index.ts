import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { config } from '../../config.js';
import { socketAuthMiddleware } from './auth-middleware.js';
import { registerFleetNamespace } from './fleet-namespace.js';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocketIO first.');
  }
  return io;
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Register the fleet namespace with auth middleware
  const fleetNs = io.of('/fleet');
  fleetNs.use(socketAuthMiddleware);
  registerFleetNamespace(fleetNs);

  return io;
}

/**
 * Broadcast an event to all sockets in a tenant room on the fleet namespace.
 */
export function broadcastToTenant(tenantId: string, event: string, data: unknown) {
  if (!io) return;
  io.of('/fleet').to(`tenant:${tenantId}`).emit(event, data);
}
