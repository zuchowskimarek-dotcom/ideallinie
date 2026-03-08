import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type {
  RnGpsPointDto,
  TrackGeometry,
  TrackLineGeometry,
  ElevationSample,
} from "@rn-ideallinie/shared-types";
import {
  projectToCartesian,
  projectPoint,
  buildTrackPoints,
  offsetPolyline,
  computeBounds,
  computeHeadings,
  interpolateElevation,
} from "../geometry/math.js";

export const geometryRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> =
  async (app, { prisma }) => {
    app.get<{ Params: { id: string } }>(
      "/tracks/:id/geometry",
      async (req, reply) => {
        try {
          const variant = await prisma.rnTrackVariantSource.findUnique({
            where: { id: req.params.id },
            select: {
              id: true,
              variantName: true,
              distanceM: true,
              widthM: true,
              centrelinePoints: true,
              startLinePoints: true,
              endLinePoints: true,
              sectorLines: true,
            },
          });

          if (!variant) {
            reply.code(404);
            return { data: null, message: "Track variant not found" };
          }

          const clGps = variant.centrelinePoints as unknown as RnGpsPointDto[];
          if (!clGps || clGps.length < 2) {
            return { data: null, message: "Insufficient centreline data" };
          }

          // 1. Project centreline to Cartesian
          const { points, originLat, originLon } = projectToCartesian(clGps);
          const gpsDirections = clGps.map((p) => p.direction);

          // 2. Build TrackPoints (with heading, curvature, arc-length)
          const centreline = buildTrackPoints(points, gpsDirections);
          const headings = centreline.map((n) => n.heading);

          // 3. Boundaries
          const halfWidth = variant.widthM / 2;
          const boundaryLeft = offsetPolyline(points, headings, halfWidth);
          const boundaryRight = offsetPolyline(points, headings, -halfWidth);

          // 4. Project special lines
          const projectLine = (
            gpsPoints: RnGpsPointDto[] | null,
            label: string
          ): TrackLineGeometry | null => {
            if (!gpsPoints || gpsPoints.length < 3) return null;
            return {
              label,
              left: projectPoint(
                gpsPoints[0]!.latitude,
                gpsPoints[0]!.longitude,
                originLat,
                originLon
              ),
              centre: projectPoint(
                gpsPoints[1]!.latitude,
                gpsPoints[1]!.longitude,
                originLat,
                originLon
              ),
              right: projectPoint(
                gpsPoints[2]!.latitude,
                gpsPoints[2]!.longitude,
                originLat,
                originLon
              ),
            };
          };

          const startLineGps =
            variant.startLinePoints as unknown as RnGpsPointDto[];
          const endLineGps =
            variant.endLinePoints as unknown as RnGpsPointDto[];
          const sectorLinesRaw = variant.sectorLines as unknown as Array<{
            description: string;
            points: RnGpsPointDto[];
          }>;

          // 5. Bounds with padding
          const allPoints = [...points, ...boundaryLeft, ...boundaryRight];
          const bounds = computeBounds(allPoints, 15);

          // 6. Elevation data from best lap's measurements
          let elevationProfile: ElevationSample[] | null = null;
          let centrelineElevation: (number | null)[] | null = null;

          try {
            const bestLap = await prisma.rnLap.findMany({
              where: { rnVariantSourceId: variant.id },
              select: {
                id: true,
                _count: { select: { measurements: true } },
              },
              orderBy: { measurements: { _count: "desc" } },
              take: 1,
            });

            if (bestLap.length > 0) {
              const measurements = await prisma.rnMeasurement.findMany({
                where: { lapId: bestLap[0]!.id },
                select: { distanceMm: true, altitudeM: true },
                orderBy: { distanceMm: "asc" },
              });

              if (measurements.length > 0) {
                elevationProfile = measurements.map((m) => ({
                  s: m.distanceMm / 1000,
                  altitudeM: m.altitudeM,
                }));

                centrelineElevation = interpolateElevation(
                  centreline.map((p) => p.s),
                  elevationProfile
                );
              }
            }
          } catch (elevErr: any) {
            // Elevation is optional — log but don't fail the whole response
            app.log.warn("Failed to fetch elevation data: " + elevErr.message);
          }

          const geometry: TrackGeometry = {
            variantId: variant.id,
            variantName: variant.variantName,
            distanceM: variant.distanceM,
            widthM: variant.widthM,
            centreline,
            boundaryLeft,
            boundaryRight,
            startLine: projectLine(startLineGps, "Start/Finish"),
            endLine: projectLine(endLineGps, "End"),
            sectorLines: (sectorLinesRaw || [])
              .map((s) => projectLine(s.points, s.description))
              .filter((s): s is TrackLineGeometry => s !== null),
            bounds,
            elevationProfile,
            centrelineElevation,
          };

          return { data: geometry, message: "Geometry computed successfully" };
        } catch (error: any) {
          app.log.error(error);
          reply.code(500);
          return {
            data: null,
            message: "Error computing geometry: " + error.message,
          };
        }
      }
    );
  };
