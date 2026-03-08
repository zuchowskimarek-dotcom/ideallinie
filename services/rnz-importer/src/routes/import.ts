import type { FastifyPluginAsync } from "fastify";
import { Prisma, PrismaClient } from "@prisma/client";
import { extractRnz } from "../parser/rnz.js";
import { parseRnXml } from "../parser/rn-xml.js";
import { parseCdrnCsv } from "../parser/cdrn-csv.js";
import { upsertDevice } from "../importer/device.js";
import { upsertTrackVariantSource } from "../importer/track.js";
import {
  upsertDriver,
  upsertEvent,
  ensureEventVariant,
  createLap,
} from "../importer/lap.js";
import { bulkInsertMeasurements } from "../importer/measurements.js";
import { bulkInsertCanRecords } from "../importer/can.js";
import type { RnImportResult } from "@rn-ideallinie/shared-types";

const prisma = new PrismaClient();

export const importRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /import/rnz
   *
   * Accepts a multipart/form-data upload with a single field "file" containing
   * the .rnz binary. Returns a structured RnImportResult.
   *
   * 409 if rnSourceLapId already exists for the same device+event (idempotent guard).
   */
  app.post("/import/rnz", async (req, reply) => {
    // --- 1. Receive file ---------------------------------------------------
    // @fastify/multipart decorates the request with .file()
    const data = await (req as any).file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded. Use field name 'file'." });
    }

    const zipBuffer = await data.toBuffer();

    // --- 2. Extract .rnz ---------------------------------------------------
    let rnBuffer: Buffer;
    let cdrnBuffer: Buffer | undefined;
    try {
      const extracted = extractRnz(zipBuffer);
      rnBuffer = extracted.rnBuffer;
      cdrnBuffer = extracted.cdrnBuffer;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: `Archive extraction failed: ${msg}` });
    }

    // --- 3. Parse ----------------------------------------------------------
    let rnDoc;
    let canRows: any[] = [];
    try {
      rnDoc = parseRnXml(rnBuffer);
      if (cdrnBuffer) {
        canRows = parseCdrnCsv(cdrnBuffer);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(422).send({ error: `Parse error: ${msg}` });
    }

    // --- 4. Check duplicate ------------------------------------------------
    // We need device + event IDs to check the composite unique key.
    // Do a quick pre-check outside the transaction to return a friendly 409.
    const existingDevice = await prisma.rnDevice.findUnique({
      where: { deviceName: rnDoc.device.deviceName },
    });
    const existingEvent = await prisma.rnEvent.findUnique({
      where: { rnEventId: rnDoc.event.rnEventId },
    });

    if (existingDevice && existingEvent) {
      const duplicate = await prisma.rnLap.findUnique({
        where: {
          sourceDeviceId_eventId_rnSourceLapId: {
            sourceDeviceId: existingDevice.id,
            eventId: existingEvent.id,
            rnSourceLapId: rnDoc.lap.rnSourceLapId,
          },
        },
      });
      if (duplicate) {
        const result: RnImportResult = {
          status: "duplicate",
          lapId: duplicate.id,
          rnSourceLapId: rnDoc.lap.rnSourceLapId,
          track: {
            id: "",
            name: rnDoc.trackVariant.rnTrackName,
            variantName: rnDoc.trackVariant.variantName,
            variantVersion: 0,
            action: "existing",
          },
          lap: {
            lapNumber: rnDoc.lap.lapNumber,
            startTime: rnDoc.lap.startTime.toISOString(),
            lapTimeMs: rnDoc.lap.lapTimeMs ?? null,
          },
          counts: { measurements: 0, canRecords: 0 },
        };
        return reply.status(409).send(result);
      }
    }

    // --- 5. Import transaction --------------------------------------------
    let lapId: string;
    let trackAction: "created" | "existing" | "new_version";
    let variantVersion: number;
    let measurementCount: number;
    let canCount: number;
    let variantSourceId: string;

    try {
      const txResult = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Cast tx to PrismaClient for our helpers
          const txClient = tx as unknown as PrismaClient;

          const devId = await upsertDevice(rnDoc!.device);

          const trackResult = await upsertTrackVariantSource(rnDoc!.trackVariant, txClient);

          const drvId = await upsertDriver(rnDoc!.driver, txClient);
          const evtId = await upsertEvent(rnDoc!.event, txClient);

          await ensureEventVariant(evtId, trackResult.variantSourceId, txClient);

          const lid = await createLap(rnDoc!.lap, {
            sourceDeviceId: devId,
            driverId: drvId,
            eventId: evtId,
            rnVariantSourceId: trackResult.variantSourceId,
            exportDeviceName: rnDoc!.exportDeviceName,
            exportDeviceVersion: rnDoc!.exportDeviceVersion,
            exportDeviceTime: rnDoc!.exportDeviceTime,
          }, txClient);

          const mCount = await bulkInsertMeasurements(lid, rnDoc!.measurements, txClient);
          const cCount = await bulkInsertCanRecords(lid, canRows!, txClient);

          return {
            lapId: lid,
            trackAction: trackResult.action,
            variantVersion: trackResult.versionNumber,
            variantSourceId: trackResult.variantSourceId,
            measurementCount: mCount,
            canCount: cCount,
          };
        },
        { timeout: 30_000 } // large files may take a moment
      );

      lapId = txResult.lapId;
      trackAction = txResult.trackAction;
      variantVersion = txResult.variantVersion;
      variantSourceId = txResult.variantSourceId;
      measurementCount = txResult.measurementCount;
      canCount = txResult.canCount;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "Import transaction failed");
      return reply.status(500).send({ error: `Database import failed: ${msg}` });
    }

    // --- 6. Return result -------------------------------------------------
    const result: RnImportResult = {
      status: "imported",
      lapId,
      rnSourceLapId: rnDoc.lap.rnSourceLapId,
      track: {
        id: variantSourceId,
        name: rnDoc.trackVariant.rnTrackName,
        variantName: rnDoc.trackVariant.variantName,
        variantVersion,
        action: trackAction,
      },
      lap: {
        lapNumber: rnDoc.lap.lapNumber,
        startTime: rnDoc.lap.startTime.toISOString(),
        lapTimeMs: rnDoc.lap.lapTimeMs ?? null,
      },
      counts: {
        measurements: measurementCount,
        canRecords: canCount,
      },
    };

    return reply.status(200).send(result);
  });
};
