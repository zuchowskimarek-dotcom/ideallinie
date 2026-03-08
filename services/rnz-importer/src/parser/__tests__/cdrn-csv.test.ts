import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import { parseCdrnCsv } from "../cdrn-csv.js";

const RNZ_PATH = join(__dirname, "../../../../../docs/rnz/20240528_133327794_RNPRO-383_Lap_10_1min25sec019.rnz");

function loadCdrnBuffer(): Buffer {
  const zipBuffer = readFileSync(RNZ_PATH);
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((e) => e.entryName.endsWith(".cdrn"));
  if (!entry) throw new Error("No .cdrn file in archive");
  return entry.getData();
}

describe("parseCdrnCsv", () => {
  it("parses 1712 CAN records", () => {
    const rows = parseCdrnCsv(loadCdrnBuffer());
    expect(rows.length).toBe(1711);
  });

  it("first record has correct structure", () => {
    const rows = parseCdrnCsv(loadCdrnBuffer());
    const first = rows[0]!;
    expect(first.rnId).toBeGreaterThan(0n);
    expect(first.channelName).toBeTruthy();
    expect(["ABS", "ESP", "ASR"]).toContain(first.channelName);
    expect(first.measuredAt).toBeInstanceOf(Date);
    expect(isNaN(first.measuredAt.getTime())).toBe(false);
  });

  it("contains expected channels ABS, ESP, ASR", () => {
    const rows = parseCdrnCsv(loadCdrnBuffer());
    const channels = new Set(rows.map((r) => r.channelName));
    expect(channels.has("ABS")).toBe(true);
    expect(channels.has("ESP")).toBe(true);
    expect(channels.has("ASR")).toBe(true);
  });

  it("handles empty buffer gracefully", () => {
    const rows = parseCdrnCsv(Buffer.from(""));
    expect(rows).toEqual([]);
  });

  it("throws on invalid header", () => {
    const bad = Buffer.from("col1;col2;col3\n1;2;3\n");
    expect(() => parseCdrnCsv(bad)).toThrow(/Invalid .cdrn header/);
  });
});
