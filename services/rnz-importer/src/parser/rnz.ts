import AdmZip from "adm-zip";
import type { RnzBuffers } from "../types.js";

/**
 * Extracts the .rn (XML) and .cdrn (CSV) buffers from a .rnz ZIP archive.
 * Throws if either expected file is missing.
 */
export function extractRnz(zipBuffer: Buffer): RnzBuffers {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  let rnEntry = entries.find((e) => e.entryName.endsWith(".rn"));
  let cdrnEntry = entries.find((e) => e.entryName.endsWith(".cdrn"));

  if (!rnEntry) {
    throw new Error("Invalid .rnz: no .rn file found inside the archive");
  }

  return {
    rnBuffer: rnEntry.getData(),
    cdrnBuffer: cdrnEntry?.getData(),
    rnFileName: rnEntry.entryName,
    cdrnFileName: cdrnEntry?.entryName,
  };
}
