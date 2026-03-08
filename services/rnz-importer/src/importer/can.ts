import { PrismaClient } from "@prisma/client";
import type { CanRow } from "../types.js";

const CHUNK_SIZE = 500;

/**
 * Bulk-inserts RnCanRecord rows in chunks of 500.
 * Returns the total count inserted.
 */
export async function bulkInsertCanRecords(
  lapId: string,
  rows: CanRow[],
  tx: PrismaClient
): Promise<number> {
  let total = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const result = await tx.rnCanRecord.createMany({
      data: chunk.map((r) => ({
        rnId: r.rnId,
        lapId,
        measuredAt: r.measuredAt,
        channelName: r.channelName,
        unit: r.unit,
        value: r.value,
      })),
    });

    total += result.count;
  }

  return total;
}
