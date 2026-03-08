import { PrismaClient } from "@prisma/client";
import type { RnDriverDoc, RnEventDoc, RnLapDoc } from "../types.js";

const prisma = new PrismaClient();

export interface LapInsertResult {
  lapId: string;
  driverId: string;
  eventId: string;
}

export async function upsertDriver(doc: RnDriverDoc, tx: PrismaClient): Promise<string> {
  const driver = await tx.rnDriver.upsert({
    where: { rnDriverId: doc.rnDriverId },
    update: { name: doc.name, surname: doc.surname ?? null },
    create: {
      rnDriverId: doc.rnDriverId,
      name: doc.name,
      surname: doc.surname ?? null,
    },
  });
  return driver.id;
}

export async function upsertEvent(doc: RnEventDoc, tx: PrismaClient): Promise<string> {
  const event = await tx.rnEvent.upsert({
    where: { rnEventId: doc.rnEventId },
    update: {
      name: doc.name,
      eventType: doc.eventType,
      startTime: doc.startTime,
      endTime: doc.endTime ?? null,
    },
    create: {
      rnEventId: doc.rnEventId,
      name: doc.name,
      eventType: doc.eventType,
      startTime: doc.startTime,
      endTime: doc.endTime ?? null,
    },
  });
  return event.id;
}

/**
 * Ensures the M:N join between an event and a track variant source exists.
 */
export async function ensureEventVariant(
  eventId: string,
  variantSourceId: string,
  tx: PrismaClient
): Promise<void> {
  await tx.rnEventVariant.upsert({
    where: {
      eventId_variantSourceId: { eventId, variantSourceId },
    },
    update: {},
    create: { eventId, variantSourceId },
  });
}

/**
 * Creates the RnLap record. Throws if the composite unique key already exists
 * (sourceDeviceId + eventId + rnSourceLapId), signalling a duplicate import.
 */
export async function createLap(
  doc: RnLapDoc,
  ids: {
    sourceDeviceId: string;
    driverId: string;
    eventId: string;
    rnVariantSourceId: string;
    exportDeviceName?: string | undefined;
    exportDeviceVersion?: string | undefined;
    exportDeviceTime?: Date | undefined;
  },
  tx: PrismaClient
): Promise<string> {
  const lap = await tx.rnLap.create({
    data: {
      rnSourceLapId: doc.rnSourceLapId,
      lapNumber: doc.lapNumber,
      lapType: doc.lapType,
      startTime: doc.startTime,
      endTime: doc.endTime ?? null,
      isStartLineCrossed: doc.isStartLineCrossed,
      isEndLineCrossed: doc.isEndLineCrossed,
      lapTimeMs: doc.lapTimeMs ?? null,
      sourceDeviceId: ids.sourceDeviceId,
      driverId: ids.driverId,
      eventId: ids.eventId,
      rnVariantSourceId: ids.rnVariantSourceId,
      vehicleNumber: doc.vehicleNumber,
      vehicleModel: doc.vehicleModel,
      exportDeviceName: ids.exportDeviceName ?? null,
      exportDeviceVersion: ids.exportDeviceVersion ?? null,
      exportDeviceTime: ids.exportDeviceTime ?? null,
    },
  });
  return lap.id;
}

export { prisma };
