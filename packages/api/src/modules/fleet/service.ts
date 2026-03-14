import { eq, and, sql } from 'drizzle-orm';
import type { CreateVehicleInput, CreateDriverInput, PaginationInput } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';

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

  const total = Number(countResult[0].count);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getVehicle(tenantId: string, id: string) {
  const [vehicle] = await db.select().from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
    .limit(1);
  if (!vehicle) throw new Error('Vehicle not found');
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
  if (!vehicle) throw new Error('Vehicle not found');
  return vehicle;
}

export async function deleteVehicle(tenantId: string, id: string) {
  const result = await db.delete(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
    .returning({ id: vehicles.id });
  if (result.length === 0) throw new Error('Vehicle not found');
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
  return driver;
}

export async function listDrivers(tenantId: string, pagination: PaginationInput) {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db.select().from(drivers)
      .where(eq(drivers.tenantId, tenantId))
      .limit(limit).offset(offset)
      .orderBy(drivers.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(drivers)
      .where(eq(drivers.tenantId, tenantId)),
  ]);

  const total = Number(countResult[0].count);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDriver(tenantId: string, id: string) {
  const [driver] = await db.select().from(drivers)
    .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)))
    .limit(1);
  if (!driver) throw new Error('Driver not found');
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
  if (!driver) throw new Error('Driver not found');
  return driver;
}

export async function deleteDriver(tenantId: string, id: string) {
  const result = await db.delete(drivers)
    .where(and(eq(drivers.id, id), eq(drivers.tenantId, tenantId)))
    .returning({ id: drivers.id });
  if (result.length === 0) throw new Error('Driver not found');
}
