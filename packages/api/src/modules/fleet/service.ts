import { eq, and, sql, ilike } from 'drizzle-orm';
import type { CreateVehicleInput, CreateDriverInput, PaginationInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers, driverStatusEnum } from '../../lib/db/schema/drivers.js';
import { NotFoundError } from '../../lib/errors.js';
import { syncSeats } from '../billing/service.js';
import { logActivity } from '../../lib/activity.js';

// ---- Vehicles ----

export async function createVehicle(tenantId: string, input: CreateVehicleInput) {
  const [vehicle] = await db
    .insert(vehicles)
    .values({
      tenantId,
      name: input.name,
      type: input.type,
      licensePlate: input.licensePlate,
      fuelType: input.fuelType,
      capacityWeight: input.capacityWeight?.toString(),
      capacityVolume: input.capacityVolume?.toString(),
      capacityCount: input.capacityCount,
      evRange: input.evRange?.toString(),
    })
    .returning();
  logActivity({ tenantId, action: 'vehicle_created', entityType: 'vehicle', entityId: vehicle.id });
  return vehicle;
}

export async function listVehicles(tenantId: string, pagination: PaginationInput) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db.select().from(vehicles)
      .where(eq(vehicles.tenantId, tenantId))
      .limit(limit).offset(offset)
      .orderBy(vehicles.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(vehicles)
      .where(eq(vehicles.tenantId, tenantId)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getVehicle(tenantId: string, id: string) {
  const [vehicle] = await db.select().from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
    .limit(1);
  if (!vehicle) throw new NotFoundError('Vehicle not found');
  return vehicle;
}

export async function updateVehicle(tenantId: string, id: string, input: Partial<CreateVehicleInput>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.licensePlate !== undefined) updates.licensePlate = input.licensePlate;
  if (input.fuelType !== undefined) updates.fuelType = input.fuelType;
  if (input.capacityWeight !== undefined) updates.capacityWeight = input.capacityWeight.toString();
  if (input.capacityVolume !== undefined) updates.capacityVolume = input.capacityVolume.toString();
  if (input.capacityCount !== undefined) updates.capacityCount = input.capacityCount;
  if (input.evRange !== undefined) updates.evRange = input.evRange.toString();

  const [vehicle] = await db.update(vehicles)
    .set(updates)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
    .returning();
  if (!vehicle) throw new NotFoundError('Vehicle not found');
  logActivity({ tenantId, action: 'vehicle_updated', entityType: 'vehicle', entityId: id });
  return vehicle;
}

export async function deleteVehicle(tenantId: string, id: string) {
  const result = await db.delete(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
    .returning({ id: vehicles.id });
  if (result.length === 0) throw new NotFoundError('Vehicle not found');
  logActivity({ tenantId, action: 'vehicle_deleted', entityType: 'vehicle', entityId: id });
}

// ---- Drivers ----

export async function createDriver(tenantId: string, input: CreateDriverInput) {
  const [driver] = await db
    .insert(drivers)
    .values({
      tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      licenseNumber: input.licenseNumber,
      userId: input.userId,
      skillTags: input.skillTags,
    })
    .returning();
  syncSeats(tenantId).catch(err => console.error('[fleet] syncSeats failed:', err));
  logActivity({ tenantId, action: 'driver_created', entityType: 'driver', entityId: driver.id });
  return driver;
}

export async function listDrivers(
  tenantId: string,
  pagination: PaginationInput,
  status?: string,
  search?: string,
) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const conditions = [eq(drivers.tenantId, tenantId)];
  if (status && driverStatusEnum.enumValues.includes(status as any)) {
    conditions.push(eq(drivers.status, status as any));
  }
  if (search) {
    const escaped = search.replace(/[%_\\]/g, '\\$&');
    conditions.push(ilike(drivers.name, `%${escaped}%`));
  }

  const where = and(...conditions);

  const [items, countResult] = await Promise.all([
    db.select().from(drivers)
      .where(where)
      .limit(limit).offset(offset)
      .orderBy(drivers.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(drivers)
      .where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDriver(tenantId: string, id: string) {
  const [driver] = await db.select().from(drivers)
    .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)))
    .limit(1);
  if (!driver) throw new NotFoundError('Driver not found');
  return driver;
}

export async function updateDriver(tenantId: string, id: string, input: Partial<CreateDriverInput>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.licenseNumber !== undefined) updates.licenseNumber = input.licenseNumber;
  if (input.skillTags !== undefined) updates.skillTags = input.skillTags;

  const [driver] = await db.update(drivers)
    .set(updates)
    .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)))
    .returning();
  if (!driver) throw new NotFoundError('Driver not found');
  logActivity({ tenantId, action: 'driver_updated', entityType: 'driver', entityId: id });
  return driver;
}

export async function deleteDriver(tenantId: string, id: string) {
  const result = await db.delete(drivers)
    .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)))
    .returning({ id: drivers.id });
  if (result.length === 0) throw new NotFoundError('Driver not found');
  syncSeats(tenantId).catch(err => console.error('[fleet] syncSeats failed:', err));
  logActivity({ tenantId, action: 'driver_deleted', entityType: 'driver', entityId: id });
}

export async function batchImportVehicles(tenantId: string, vehicleInputs: CreateVehicleInput[]) {
  const created = [];
  for (const input of vehicleInputs) {
    const v = await createVehicle(tenantId, input);
    created.push(v);
  }
  return { imported: created.length };
}

export async function batchImportDrivers(tenantId: string, driverInputs: CreateDriverInput[]) {
  const created = [];
  for (const input of driverInputs) {
    const d = await createDriver(tenantId, input);
    created.push(d);
  }
  return { imported: created.length };
}
