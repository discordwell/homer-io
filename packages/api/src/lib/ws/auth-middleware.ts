import { createVerifier } from 'fast-jwt';
import type { Socket } from 'socket.io';
import { config } from '../../config.js';
import type { JwtPayload } from '../../plugins/auth.js';

declare module 'socket.io' {
  interface Socket {
    user: JwtPayload;
  }
}

const verifyJwt = createVerifier({ key: config.jwt.secret });

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = verifyJwt(token) as JwtPayload;
    socket.user = payload;
    // Join tenant-specific room for scoped broadcasts
    socket.join(`tenant:${payload.tenantId}`);
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}
