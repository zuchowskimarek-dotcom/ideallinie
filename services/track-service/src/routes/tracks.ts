import type { FastifyPluginAsync } from "fastify";

export const trackRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tracks", async () => ({
    data: [],
    message: "Track listing stub — DB not connected yet",
  }));

  app.get<{ Params: { id: string } }>("/tracks/:id", async (req) => ({
    data: null,
    message: `Track ${req.params.id} stub — DB not connected yet`,
  }));

  app.get<{ Params: { id: string } }>("/tracks/:id/corridor", async (req) => ({
    data: null,
    message: `Corridor for ${req.params.id} stub — DB not connected yet`,
  }));
};
