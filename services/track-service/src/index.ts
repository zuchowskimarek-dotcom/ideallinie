import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "dotenv";
import { healthRoutes } from "./routes/health.js";
import { trackRoutes } from "./routes/tracks.js";
import { geometryRoutes } from "./routes/geometry.js";
import { PrismaClient } from "@prisma/client";

config({ path: "../../.env" });

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

const PORT = Number(process.env.TRACK_SERVICE_PORT) || 8002;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(trackRoutes, { prisma });
  await app.register(geometryRoutes, { prisma });

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
