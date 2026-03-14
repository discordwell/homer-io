import type { Namespace } from 'socket.io';
import { locationUpdateSchema } from '@homer-io/shared';
import { updateDriverLocation } from '../../modules/tracking/service.js';

export function registerFleetNamespace(ns: Namespace) {
  ns.on('connection', (socket) => {
    const { tenantId, id: userId, role } = socket.user;

    socket.on('driver:location', async (data: unknown) => {
      try {
        // Only drivers can send location updates
        if (role !== 'driver') {
          socket.emit('error', { message: 'Only drivers can send location updates' });
          return;
        }

        const location = locationUpdateSchema.parse(data);

        // Find the driver ID associated with this user
        const { findDriverByUserId } = await import('../../modules/tracking/service.js');
        const driverId = await findDriverByUserId(tenantId, userId);
        if (!driverId) {
          socket.emit('error', { message: 'No driver profile linked to this user' });
          return;
        }

        await updateDriverLocation(tenantId, driverId, location);
      } catch (err) {
        socket.emit('error', { message: err instanceof Error ? err.message : 'Invalid location data' });
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect — no special handling needed
    });
  });
}
