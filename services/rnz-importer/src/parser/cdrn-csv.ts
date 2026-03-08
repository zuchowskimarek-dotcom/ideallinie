import type { CanRow } from "../types.js";

/**
 * Parses the .cdrn semicolon-delimited CSV (UTF-8 with optional BOM).
 * Header: id;measurementtime;lapid;name;unit;value
 */
export function parseCdrnCsv(buffer: Buffer | undefined | null): CanRow[] {
  if (!buffer || buffer.length === 0) return [];
  // Strip UTF-8 BOM if present
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) return []; // header only or empty

  // Validate header
  const header = lines[0]!.toLowerCase().split(";").map((h) => h.trim());
  const idIdx = header.indexOf("id");
  const timeIdx = header.indexOf("measurementtime");
  const nameIdx = header.indexOf("name");
  const unitIdx = header.indexOf("unit");
  const valueIdx = header.indexOf("value");

  if (idIdx < 0 || timeIdx < 0 || nameIdx < 0 || unitIdx < 0 || valueIdx < 0) {
    throw new Error(
      `Invalid .cdrn header — expected id;measurementtime;lapid;name;unit;value, got: ${lines[0]}`
    );
  }

  const rows: CanRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(";");
    const rawTime = cols[timeIdx]?.trim();
    if (!rawTime) continue;

    // RN custom date format: "YYYY-MM-DD HH:mm:ss.fff" → treat as UTC
    const measuredAt = new Date(rawTime.replace(" ", "T") + "Z");
    if (isNaN(measuredAt.getTime())) continue;

    rows.push({
      rnId: BigInt(cols[idIdx]?.trim() ?? "0"),
      measuredAt,
      channelName: cols[nameIdx]?.trim() ?? "",
      unit: cols[unitIdx]?.trim() ?? "",
      value: parseFloat(cols[valueIdx]?.trim() ?? "0"),
    });
  }

  return rows;
}
