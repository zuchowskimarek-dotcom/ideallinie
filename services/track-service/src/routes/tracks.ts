import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { RnGpsPointDto, TrackOutline } from "@rn-ideallinie/shared-types";
import {
  projectToCartesian,
  computeBounds,
  simplifyPolyline,
} from "../geometry/math.js";

function computeOutline(
  centrelinePoints: unknown,
  variantId: string
): TrackOutline | null {
  try {
    const gpsPoints = centrelinePoints as unknown as RnGpsPointDto[];
    if (!gpsPoints || gpsPoints.length < 2) return null;
    const { points } = projectToCartesian(gpsPoints);
    const simplified = simplifyPolyline(points, 1.0);
    const bounds = computeBounds(simplified, 5);
    return { variantId, points: simplified, bounds };
  } catch {
    return null;
  }
}

export const trackRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (app, { prisma }) => {
  app.get("/tracks", async () => {
    try {
      const variants = await prisma.rnTrackVariantSource.findMany({
        select: {
          id: true,
          rnTrackId: true,
          variantName: true,
          trackType: true,
          centrelinePoints: true,
          distanceM: true,
          widthM: true,
        },
        orderBy: { variantName: "asc" }
      });

      return {
        data: variants.map(v => ({
          id: v.id,
          name: v.variantName,
          location: "Imported Track",
          countryCode: "??",
          image: "/track-placeholder.png",
          distanceM: v.distanceM,
          widthM: v.widthM,
          outline: computeOutline(v.centrelinePoints, v.id),
        })),
        message: "Successfully fetched real track variants",
      };
    } catch (error: any) {
      app.log.error(error);
      return {
        data: [],
        message: "Error fetching tracks: " + error.message,
      };
    }
  });

  app.get<{ Params: { id: string } }>("/tracks/:id", async (req) => {
    const track = await prisma.rnTrackVariantSource.findUnique({
      where: { id: req.params.id }
    });
    return {
      data: track,
      message: track ? "Track found" : "Track not found",
    };
  });

  app.get<{ Params: { id: string } }>("/tracks/:id/corridor", async (req) => ({
    data: null,
    message: `Corridor for ${req.params.id} stub`,
  }));
};
