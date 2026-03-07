import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { trajectoryRoutes } from "./routes/trajectories.js";

const PORT = Number(process.env.TRAJECTORY_SERVICE_PORT) || 8003;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(trajectoryRoutes);

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
