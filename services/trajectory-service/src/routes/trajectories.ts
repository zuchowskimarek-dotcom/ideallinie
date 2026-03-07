import type { FastifyPluginAsync } from "fastify";

export const trajectoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/trajectories", async () => ({
    data: [],
    message: "Trajectory listing stub — DB not connected yet",
  }));

  app.get<{ Params: { id: string } }>("/trajectories/:id", async (req) => ({
    data: null,
    message: `Trajectory ${req.params.id} stub — DB not connected yet`,
  }));

  app.post("/trajectories/compare", async () => ({
    data: null,
    message: "Comparison stub — not yet implemented",
  }));
};
