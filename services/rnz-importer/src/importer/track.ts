import { PrismaClient } from "@prisma/client";
import type { RnTrackVariantDoc, RnGpsPoint } from "../types.js";

const prisma = new PrismaClient();

export interface TrackUpsertResult {
  variantSourceId: string;
  action: "created" | "existing" | "new_version";
  versionNumber: number;
}

/**
 * Upserts a track variant source with versioning:
 * - First import of a variant → version 1 (created)
 * - Re-import with identical XML → no change (existing)
 * - Re-import with changed XML → new row, version = max + 1 (new_version)
 */
export async function upsertTrackVariantSource(
  doc: RnTrackVariantDoc,
  tx: PrismaClient
): Promise<TrackUpsertResult> {
  // Find all existing versions for this variantId
  const existing = await tx.rnTrackVariantSource.findMany({
    where: { rnVariantId: doc.rnVariantId },
    orderBy: { versionNumber: "desc" },
  });

  if (existing.length > 0) {
    const latest = existing[0]!;

    // Identical re-import — skip
    if (latest.rawDefinitionXml === doc.rawDefinitionXml) {
      return {
        variantSourceId: latest.id,
        action: "existing",
        versionNumber: latest.versionNumber,
      };
    }

    // Changed definition → new version
    const nextVersion = latest.versionNumber + 1;
    const created = await tx.rnTrackVariantSource.create({
      data: {
        rnTrackId: doc.rnTrackId,
        rnVariantId: doc.rnVariantId,
        variantName: doc.variantName,
        versionNumber: nextVersion,
        rawDefinitionXml: doc.rawDefinitionXml,
        centrelinePoints: doc.centrelinePoints as unknown as RnGpsPoint[],
        startLinePoints: doc.startLinePoints as unknown as RnGpsPoint[],
        endLinePoints: doc.endLinePoints as unknown as RnGpsPoint[],
        sectorLines: doc.sectorLines as object[],
        distanceM: doc.distanceM,
        widthM: doc.widthM,
        trackType: doc.trackType,
      },
    });
    return {
      variantSourceId: created.id,
      action: "new_version",
      versionNumber: nextVersion,
    };
  }

  // First time — create version 1
  const created = await tx.rnTrackVariantSource.create({
    data: {
      rnTrackId: doc.rnTrackId,
      rnVariantId: doc.rnVariantId,
      variantName: doc.variantName,
      versionNumber: 1,
      rawDefinitionXml: doc.rawDefinitionXml,
      centrelinePoints: doc.centrelinePoints as unknown as RnGpsPoint[],
      startLinePoints: doc.startLinePoints as unknown as RnGpsPoint[],
      endLinePoints: doc.endLinePoints as unknown as RnGpsPoint[],
      sectorLines: doc.sectorLines as object[],
      distanceM: doc.distanceM,
      widthM: doc.widthM,
      trackType: doc.trackType,
    },
  });
  return {
    variantSourceId: created.id,
    action: "created",
    versionNumber: 1,
  };
}

export { prisma };
