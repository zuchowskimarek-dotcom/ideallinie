import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import { parseRnXml } from "../rn-xml.js";

// Real .rnz file is in docs/rnz/ relative to project root
const RNZ_PATH = join(__dirname, "../../../../../docs/rnz/20240528_133327794_RNPRO-383_Lap_10_1min25sec019.rnz");

function loadRnBuffer(): Buffer {
  const zipBuffer = readFileSync(RNZ_PATH);
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((e) => e.entryName.endsWith(".rn"));
  if (!entry) throw new Error("No .rn file in archive");
  return entry.getData();
}

describe("parseRnXml", () => {
  it("parses lap metadata correctly", () => {
    const doc = parseRnXml(loadRnBuffer());
    expect(doc.lap.lapNumber).toBe(10);
    expect(doc.lap.rnSourceLapId).toBe(5490);
    // Lap time 1:25.019 = 85019 ms (from ZIP comment; XML may store differently)
    if (doc.lap.lapTimeMs != null) {
      expect(doc.lap.lapTimeMs).toBeCloseTo(85019, -2);
    }
    expect(doc.lap.isStartLineCrossed).toBe(true);
    expect(doc.lap.isEndLineCrossed).toBe(true);
  });

  it("parses device info", () => {
    const doc = parseRnXml(loadRnBuffer());
    expect(doc.device.deviceName).toBe("RNPRO-383");
    expect(doc.device.deviceType).toBe("RNPRO");
  });

  it("parses driver", () => {
    const doc = parseRnXml(loadRnBuffer());
    expect(doc.driver.rnDriverId).toBeGreaterThan(0);
    expect(doc.driver.name).toBeTruthy();
  });

  it("parses event", () => {
    const doc = parseRnXml(loadRnBuffer());
    expect(doc.event.rnEventId).toBeGreaterThan(0);
    expect(doc.event.name).toContain("Varano");
  });

  it("parses track variant", () => {
    const doc = parseRnXml(loadRnBuffer());
    expect(doc.trackVariant.rnVariantId).toBe("10DAFF9D-E360-458D-9300-9D6DC05C9D1A");
    expect(doc.trackVariant.variantName).toBe("Varano Long");
    expect(doc.trackVariant.distanceM).toBe(2350);
    expect(doc.trackVariant.curves.length).toBe(10);
  });

  it("parses 851 measurements", () => {
    const doc = parseRnXml(loadRnBuffer());
    expect(doc.measurements.length).toBe(851);
  });

  it("first measurement has correct GPS data", () => {
    const doc = parseRnXml(loadRnBuffer());
    const first = doc.measurements[0]!;
    expect(first.latitude).toBeCloseTo(44.6806255, 4);
    expect(first.gpsSpeedKph).toBeCloseTo(180.09, 0);
    expect(first.measurementNumber).toBe(1);
  });

  it("measurements have valid division (gs ÷ 100)", () => {
    const doc = parseRnXml(loadRnBuffer());
    // Speed should be in km/h after ÷100. 180 km/h is realistic for MC20.
    const speeds = doc.measurements.map((m) => m.gpsSpeedKph);
    const maxSpeed = Math.max(...speeds);
    expect(maxSpeed).toBeGreaterThan(100);
    expect(maxSpeed).toBeLessThan(350);
  });
});
