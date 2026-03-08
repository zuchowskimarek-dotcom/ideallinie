import { PrismaClient } from "@prisma/client";
import type { RnSmSample } from "../types.js";

const CHUNK_SIZE = 500;

/**
 * Bulk-inserts RnMeasurement rows in chunks of 500 using createMany.
 * Returns the total count inserted.
 */
export async function bulkInsertMeasurements(
  lapId: string,
  samples: RnSmSample[],
  tx: PrismaClient
): Promise<number> {
  let total = 0;

  for (let i = 0; i < samples.length; i += CHUNK_SIZE) {
    const chunk = samples.slice(i, i + CHUNK_SIZE);

    const result = await tx.rnMeasurement.createMany({
      data: chunk.map((s) => ({
        rnId: s.rnId,
        lapId,
        measuredAt: s.measuredAt,
        latitude: s.latitude,
        longitude: s.longitude,
        altitudeM: s.altitudeM,
        directionDeg: s.directionDeg,
        gpsSpeedKph: s.gpsSpeedKph,
        gpsPosDeviationCm: s.gpsPosDeviationCm,
        gpsAccuracy: s.gpsAccuracy,
        isGpsValid: s.isGpsValid,
        isPositionCalculated: s.isPositionCalculated,
        lateralG: s.lateralG,
        longitudinalG: s.longitudinalG,
        verticalG: s.verticalG,
        pitchRateDs: s.pitchRateDs,
        rollRateDs: s.rollRateDs,
        yawRateDs: s.yawRateDs,
        isGyroValid: s.isGyroValid,
        distanceMm: s.distanceMm,
        distanceOffsetMm: s.distanceOffsetMm,
        rpm: s.rpm,
        throttlePct: s.throttlePct,
        obdSpeedKph: s.obdSpeedKph,
        oilTempC: s.oilTempC,
        coolantTempC: s.coolantTempC,
        isObdValid: s.isObdValid,
        gear: s.gear ?? null,
        steeringAngle: s.steeringAngle ?? null,
        brakePct: s.brakePct ?? null,
        oilPressureBar: s.oilPressureBar ?? null,
        measurementNumber: s.measurementNumber,
      })),
    });

    total += result.count;
  }

  return total;
}
