import Fastify from "fastify";
import cors from "@fastify/cors";
import proxy from "@fastify/http-proxy";
import { healthRoutes } from "./routes/health.js";

const PORT = Number(process.env.API_PORT) || 3000;
const RNZ_IMPORTER_URL = process.env.RNZ_IMPORTER_URL || "http://localhost:8004";
const TRACK_SERVICE_URL = process.env.TRACK_SERVICE_URL || "http://localhost:8002";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);

  // --- Proxy Routes ---
  await app.register(proxy, {
    upstream: RNZ_IMPORTER_URL,
    prefix: "/api/import",
    rewritePrefix: "/import",
  });

  await app.register(proxy, {
    upstream: TRACK_SERVICE_URL,
    prefix: "/api/tracks",
    rewritePrefix: "/tracks",
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
