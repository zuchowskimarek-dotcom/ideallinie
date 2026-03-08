import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { config } from "dotenv";
import { healthRoutes } from "./routes/health.js";
import { importRoutes } from "./routes/import.js";

config({ path: "../../.env" });

const PORT = Number(process.env.RNZ_IMPORTER_PORT) || 8004;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  });
  await app.register(healthRoutes);
  await app.register(importRoutes);

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
