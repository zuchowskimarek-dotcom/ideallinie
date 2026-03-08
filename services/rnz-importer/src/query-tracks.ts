import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    const tracks = await prisma.track.findMany({
      select: { id: true, name: true, country: true }
    });
    console.log("REAL_TRACKS_START");
    console.log(JSON.stringify(tracks, null, 2));
    console.log("REAL_TRACKS_END");

    const rnSources = await prisma.rnTrackVariantSource.findMany({
      select: { id: true, rnTrackId: true, variantName: true, trackType: true }
    });
    console.log("RN_SOURCES_START");
    console.log(JSON.stringify(rnSources, null, 2));
    console.log("RN_SOURCES_END");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
