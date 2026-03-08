import { PrismaClient } from "@prisma/client";
import type { RnDeviceDoc } from "../types.js";

const prisma = new PrismaClient();

/**
 * Upserts an RnDevice by deviceName. Returns the internal UUID.
 */
export async function upsertDevice(doc: RnDeviceDoc): Promise<string> {
  const device = await prisma.rnDevice.upsert({
    where: { deviceName: doc.deviceName },
    update: {},
    create: {
      deviceName: doc.deviceName,
      deviceType: doc.deviceType ?? null,
    },
  });
  return device.id;
}

export { prisma };
