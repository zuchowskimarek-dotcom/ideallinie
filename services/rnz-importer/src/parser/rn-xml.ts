import { XMLParser } from "fast-xml-parser";
import type {
  RnXmlDoc,
  RnGpsPoint,
  RnSectorLine,
  RnCurve,
} from "../types.js";

// ---------------------------------------------------------------------------
// RN custom date format: "YYYY-MM-DD HH:mm:ss.fff"  (no T, no timezone)
// ---------------------------------------------------------------------------
function parseRnDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  // Replace space with T so Date can parse it; treat as UTC for storage
  return new Date(raw.replace(" ", "T") + "Z");
}

function requireRnDate(raw: string | undefined, field: string): Date {
  const d = parseRnDate(raw);
  if (!d || isNaN(d.getTime())) {
    throw new Error(`Missing or invalid RN date for field: ${field}`);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Reference point array normalisation
// fast-xml-parser returns a single object (not array) when there is only 1 child
// ---------------------------------------------------------------------------
function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function parseReferencePoints(
  container: Record<string, unknown> | undefined
): RnGpsPoint[] {
  if (!container) return [];
  const raw = toArray(
    (container as Record<string, unknown>)["referencePoint"]
  ) as Array<Record<string, string>>;
  return raw.map((rp) => ({
    latitude: parseFloat(rp["@_latitude"] ?? "0"),
    longitude: parseFloat(rp["@_longitude"] ?? "0"),
    direction: parseFloat(rp["@_direction"] ?? "0"),
    description: rp["@_description"] ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Definition XML parsing (the nested <trackDataXml><definition> fragment)
// ---------------------------------------------------------------------------
interface DefinitionXml {
  startLine?: Record<string, unknown>;
  endLine?: Record<string, unknown>;
  sectors?: { sector?: unknown };
  curves?: { curve?: unknown };
}

function parseDefinition(defXml: string): {
  startLinePoints: RnGpsPoint[];
  endLinePoints: RnGpsPoint[];
  sectorLines: RnSectorLine[];
  curves: RnCurve[];
} {
  const innerParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const root = innerParser.parse(defXml) as { definition?: DefinitionXml };
  const def = root["definition"] ?? {};

  const startLinePoints = parseReferencePoints(
    (def.startLine as Record<string, unknown> | undefined)?.["referencePoints"] as Record<string, unknown> | undefined
  );
  const endLinePoints = parseReferencePoints(
    (def.endLine as Record<string, unknown> | undefined)?.["referencePoints"] as Record<string, unknown> | undefined
  );

  const rawSectors = toArray(def.sectors?.["sector"]) as Array<Record<string, unknown>>;
  const sectorLines: RnSectorLine[] = rawSectors.map((s) => ({
    description: String(s["@_description"] ?? s["description"] ?? ""),
    points: parseReferencePoints(s["referencePoints"] as Record<string, unknown> | undefined),
  }));

  const rawCurves = toArray(def.curves?.["curve"]) as Array<Record<string, unknown>>;
  const curves: RnCurve[] = rawCurves.map((c) => ({
    description: String(c["@_description"] ?? c["description"] ?? ""),
    points: parseReferencePoints(c["referencePoints"] as Record<string, unknown> | undefined),
  }));

  return { startLinePoints, endLinePoints, sectorLines, curves };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------
export function parseRnXml(buffer: Buffer): RnXmlDoc {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Keep CDATA sections as-is (used in trackDataXml)
    cdataPropName: "__cdata",
    // Stop parsing at trackDataXml to keep it as a raw string fragment
    stopNodes: ["lapData.trackVariant.trackDataXml", "trackDataXml"],
    trimValues: true,
  });

  const raw = parser.parse(buffer.toString("utf-8")) as Record<string, unknown>;
  const root = raw["lapData"] as Record<string, unknown>;

  if (!root) throw new Error("Invalid .rn XML: missing <lapData> root element");

  // Helper to get value from attribute or child element
  const getVal = (node: any, name: string): string => {
    if (!node) return "";
    const val = node[`@_${name}`] ?? node[name];
    if (val == null) return "";
    if (typeof val === "object") {
      return String(val["#text"] ?? val["__cdata"] ?? "");
    }
    return String(val);
  };

  // Helper to handle potential arrays if tags are duplicated
  const toFirst = (node: any) => (Array.isArray(node) ? node[0] : node);

  // --- device info ---------------------------------------------------------
  const sourceDeviceName = String(root["@_sourceDeviceName"] ?? root["@_lastExportRnDeviceName"] ?? "");
  const exportDeviceName = String(root["@_exportDeviceName"] ?? "");
  const exportDeviceVersion = root["@_exportDeviceVersion"] != null
    ? String(root["@_exportDeviceVersion"])
    : undefined;
  const exportDeviceTimeRaw = root["@_exportDeviceTime"] != null
    ? String(root["@_exportDeviceTime"])
    : undefined;

  // Infer deviceType from prefix (RNPRO-383 → RNPRO)
  const deviceType = sourceDeviceName.split("-")[0] || undefined;

  // --- lap -----------------------------------------------------------------
  const lapNode = toFirst(root["lap"]);
  if (!lapNode) throw new Error("Missing <lap> element");

  const startTime = requireRnDate(getVal(lapNode, "startTime"), "lap.startTime");
  const endTimeRaw = getVal(lapNode, "endTime") || undefined;
  const lapTimeMsRaw = lapNode["@_lapTime"] ?? lapNode["@_lapTimeMs"] ?? lapNode["lapTime"] ?? lapNode["lapTimeMs"];
  const lapTimeMs = lapTimeMsRaw != null ? Math.round(Number(lapTimeMsRaw)) : undefined;

  // --- driver --------------------------------------------------------------
  const driverNode = toFirst(root["driver"]);
  if (!driverNode) throw new Error("Missing <driver> element");

  const driverName = getVal(driverNode, "name") || getVal(driverNode, "driverName") || "Unknown Driver";
  const driverSurname = getVal(driverNode, "surname") || getVal(driverNode, "driverSurname");

  // --- event ---------------------------------------------------------------
  const eventNode = toFirst(root["event"]);
  if (!eventNode) throw new Error("Missing <event> element");

  const eventStartTime = requireRnDate(getVal(eventNode, "startTime"), "event.startTime");
  const eventEndRaw = getVal(eventNode, "endTime") || undefined;

  // --- vehicle (stored on lap) ---------------------------------------------
  const vehicleNode = root["vehicle"] as Record<string, unknown> | undefined;
  const vehicleNumber = vehicleNode ? getVal(vehicleNode, "number") : getVal(lapNode, "vehicleNumber");
  const vehicleModel = vehicleNode ? getVal(vehicleNode, "model") : getVal(lapNode, "vehicleModel");

  // --- track ---------------------------------------------------------------
  const trackNode = root["track"] as Record<string, unknown>;
  if (!trackNode) throw new Error("Missing <track> element");

  // --- trackVariant --------------------------------------------------------
  const tvNode = root["trackVariant"] as Record<string, unknown>;
  if (!tvNode) throw new Error("Missing <trackVariant> element");

  // trackDataXml is a stopNode, so it's likely an object with #text, __cdata, or the inner XML
  const tdx = tvNode["trackDataXml"] as any;
  let rawDefinitionXml = "";
  if (typeof tdx === "string") {
    rawDefinitionXml = tdx;
  } else if (tdx) {
    rawDefinitionXml = String(tdx["#text"] ?? tdx["__cdata"] ?? tdx["definition"] ?? "");
  }

  // If it's still wrapped in <trackDataXml>, strip it (happens with stopNodes sometimes)
  if (rawDefinitionXml.includes("<trackDataXml>")) {
    rawDefinitionXml = rawDefinitionXml
      .replace("<trackDataXml>", "")
      .replace("</trackDataXml>", "")
      .trim();
  }

  const { startLinePoints, endLinePoints, sectorLines, curves } =
    rawDefinitionXml ? parseDefinition(rawDefinitionXml) : {
      startLinePoints: [],
      endLinePoints: [],
      sectorLines: [],
      curves: [],
    };

  // centreline = first curve in the definition (or empty)
  const centrelinePoints =
    curves.length > 0
      ? curves[0]!.points
      : startLinePoints;

  // --- measurements --------------------------------------------------------
  const measurementsNode = root["measurements"] as Record<string, unknown> | undefined;
  const rawSamples = toArray(measurementsNode?.["sm"]) as Array<Record<string, string>>;

  const measurements = rawSamples.map((sm) => ({
    rnId: parseInt(sm["@_id"] ?? "0", 10),
    measuredAt: requireRnDate(sm["@_mt"], "sm.mt"),
    latitude: parseFloat(sm["@_lt"] ?? "0"),
    longitude: parseFloat(sm["@_lg"] ?? "0"),
    altitudeM: parseFloat(sm["@_al"] ?? "0"),
    directionDeg: parseFloat(sm["@_dr"] ?? "0"),
    // Speed: some versions have (km/h * 100) + 20000. 
    // If raw value > 20000, subtract offset; otherwise assume direct 1/100 scale.
    gpsSpeedKph: (() => {
      const v = parseInt(sm["@_gs"] ?? "0", 10);
      return v >= 20000 ? (v - 20000) / 100 : v / 100;
    })(),
    gpsPosDeviationCm: parseInt(sm["@_gd"] ?? "0", 10),
    gpsAccuracy: parseInt(sm["@_ga"] ?? "0", 10),
    isGpsValid: sm["@_igpsv"] === "true",
    isPositionCalculated: sm["@_ipc"] === "true",
    lateralG: parseInt(sm["@_la"] ?? "0", 10) / 100,
    longitudinalG: parseInt(sm["@_lo"] ?? "0", 10) / 100,
    verticalG: parseInt(sm["@_za"] ?? "0", 10) / 100,
    pitchRateDs: parseInt(sm["@_ph"] ?? "0", 10) / 100,
    rollRateDs: parseInt(sm["@_rl"] ?? "0", 10) / 100,
    yawRateDs: parseInt(sm["@_ya"] ?? "0", 10) / 100,
    isGyroValid: sm["@_igyrv"] === "true",
    distanceMm: parseInt(sm["@_ds"] ?? "0", 10),
    distanceOffsetMm: parseInt(sm["@_df"] ?? "0", 10),
    rpm: parseInt(sm["@_rp"] ?? "0", 10),
    throttlePct: parseInt(sm["@_tp"] ?? "0", 10),
    obdSpeedKph: parseInt(sm["@_os"] ?? "0", 10) / 100,
    oilTempC: parseInt(sm["@_ot"] ?? "0", 10),
    coolantTempC: parseInt(sm["@_wt"] ?? "0", 10),
    isObdValid: sm["@_iobdv"] === "true",
    gear: sm["@_gr"] != null ? parseInt(sm["@_gr"], 10) : undefined,
    steeringAngle: sm["@_sa"] != null ? parseInt(sm["@_sa"], 10) : undefined,
    brakePct: sm["@_bp"] != null ? parseInt(sm["@_bp"], 10) : undefined,
    oilPressureBar: sm["@_op"] != null ? parseFloat(sm["@_op"]) : undefined,
    measurementNumber: parseInt(sm["@_mn"] ?? "0", 10),
  }));

  return {
    device: { deviceName: sourceDeviceName, deviceType },
    exportDeviceName: exportDeviceName || undefined,
    exportDeviceVersion,
    exportDeviceTime: parseRnDate(exportDeviceTimeRaw),
    lap: {
      rnSourceLapId: parseInt(getVal(lapNode, "sourceLapId") || "0", 10),
      lapNumber: parseInt(getVal(lapNode, "lapNumber") || "0", 10),
      lapType: parseInt(getVal(lapNode, "lapType") || "0", 10),
      startTime,
      endTime: parseRnDate(endTimeRaw),
      isStartLineCrossed: getVal(lapNode, "isStartLineCrossed") === "true",
      isEndLineCrossed: getVal(lapNode, "isEndLineCrossed") === "true",
      lapTimeMs,
      vehicleNumber,
      vehicleModel,
    },
    driver: {
      rnDriverId: parseInt(getVal(driverNode, "id") || "0", 10),
      name: driverName,
      surname: driverSurname || undefined,
    },
    event: {
      rnEventId: parseInt(getVal(eventNode, "id") || "0", 10),
      name: getVal(eventNode, "name") || getVal(eventNode, "eventName") || "Unknown Event",
      eventType: parseInt(getVal(eventNode, "eventType") || "0", 10),
      startTime: eventStartTime,
      endTime: parseRnDate(eventEndRaw),
    },
    trackVariant: {
      rnTrackId: String(trackNode["id"] ?? ""),
      rnTrackName: String(trackNode["name"] ?? ""),
      rnVariantId: String(tvNode["id"] ?? ""),
      variantName: String(tvNode["name"] ?? ""),
      distanceM: parseInt(String(tvNode["distance"] ?? trackNode["distance"] ?? "0"), 10),
      widthM: parseFloat(String(tvNode["width"] ?? trackNode["width"] ?? "0")),
      trackType: parseInt(String(trackNode["trackType"] ?? "0"), 10),
      rawDefinitionXml,
      centrelinePoints,
      startLinePoints,
      endLinePoints,
      sectorLines,
      curves,
    },
    measurements,
  };
}
