/**
 * One-shot seed script: updates centrelinePoints for all RnTrackVariantSource rows
 * by parsing rawDefinitionXml and concatenating ALL curve segments.
 *
 * Run: npx tsx scripts/seed-centrelines.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";

interface GpsPoint {
  latitude: number;
  longitude: number;
  direction: number;
  description?: string;
}

interface Curve {
  description: string;
  points: GpsPoint[];
}

// --- Helpers (mirrored from rnz-importer/src/parser/rn-xml.ts) ---

function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function parseReferencePoints(
  container: Record<string, unknown> | undefined
): GpsPoint[] {
  if (!container) return [];
  const raw = toArray(
    container["referencePoint"]
  ) as Array<Record<string, string>>;
  return raw.map((rp) => ({
    latitude: parseFloat(rp["@_latitude"] ?? "0"),
    longitude: parseFloat(rp["@_longitude"] ?? "0"),
    direction: parseFloat(rp["@_direction"] ?? "0"),
    description: rp["@_description"] ?? "",
  }));
}

function parseCurvesFromXml(rawXml: string): Curve[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const root = parser.parse(rawXml) as {
    definition?: { curves?: { curve?: unknown } };
  };
  const def = root["definition"] ?? {};
  const rawCurves = toArray(def.curves?.["curve"]) as Array<
    Record<string, unknown>
  >;
  return rawCurves.map((c) => ({
    description: String(c["@_description"] ?? c["description"] ?? ""),
    points: parseReferencePoints(
      c["referencePoints"] as Record<string, unknown> | undefined
    ),
  }));
}

function gpsDistanceM(a: GpsPoint, b: GpsPoint): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const cosLat = Math.cos(
    (((a.latitude + b.latitude) / 2) * Math.PI) / 180
  );
  return Math.sqrt(dLat * dLat + dLon * cosLat * (dLon * cosLat)) * R;
}

function buildFullCentreline(curves: Curve[]): GpsPoint[] {
  if (curves.length === 0) return [];
  const result: GpsPoint[] = [...curves[0]!.points];
  for (let i = 1; i < curves.length; i++) {
    const curvePoints = curves[i]!.points;
    if (curvePoints.length === 0) continue;
    const last = result[result.length - 1];
    const first = curvePoints[0]!;
    const startIdx = last && gpsDistanceM(last, first) < 0.5 ? 1 : 0;
    for (let j = startIdx; j < curvePoints.length; j++) {
      result.push(curvePoints[j]!);
    }
  }
  return result;
}

// --- Main ---

async function main() {
  const prisma = new PrismaClient();

  try {
    const variants = await prisma.rnTrackVariantSource.findMany({
      select: {
        id: true,
        variantName: true,
        rawDefinitionXml: true,
        centrelinePoints: true,
      },
    });

    console.log(`Found ${variants.length} track variant(s) to process.\n`);

    for (const v of variants) {
      const oldPoints = v.centrelinePoints as unknown as GpsPoint[];
      const oldCount = Array.isArray(oldPoints) ? oldPoints.length : 0;

      if (!v.rawDefinitionXml) {
        console.log(
          `  SKIP  ${v.variantName} — no rawDefinitionXml stored`
        );
        continue;
      }

      const curves = parseCurvesFromXml(v.rawDefinitionXml);
      const fullCentreline = buildFullCentreline(curves);

      if (fullCentreline.length <= oldCount) {
        console.log(
          `  SKIP  ${v.variantName} — already has ${oldCount} pts (parsed ${fullCentreline.length})`
        );
        continue;
      }

      await prisma.rnTrackVariantSource.update({
        where: { id: v.id },
        data: {
          centrelinePoints: fullCentreline as unknown as any,
        },
      });

      console.log(
        `  OK    ${v.variantName}: ${oldCount} pts → ${fullCentreline.length} pts (${curves.length} curves)`
      );
    }

    console.log("\nDone.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
