import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";

export const trackRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (app, { prisma }) => {
  app.get("/tracks", async () => {
    try {
      const variants = await prisma.rnTrackVariantSource.findMany({
        select: {
          id: true,
          rnTrackId: true,
          variantName: true,
          trackType: true,
          // We can't easily get location from the raw XML blobs here without parsing, 
          // but we can at least return the variant names.
        },
        orderBy: { variantName: "asc" }
      });

      return {
        data: variants.map(v => ({
          id: v.id,
          name: v.variantName,
          location: "Imported Track", // Placeholder for now
          countryCode: "??",
          image: "/track-placeholder.png"
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
