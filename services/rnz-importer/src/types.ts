// Internal DTOs produced by parsers — not exported externally.
// These mirror the raw RN XML/CSV structures before DB insertion.

export interface RnGpsPoint {
  latitude: number;
  longitude: number;
  direction: number; // degrees, 0=North clockwise
  description?: string | undefined;
}

export interface RnSectorLine {
  description: string;
  points: RnGpsPoint[];
}

export interface RnCurve {
  description: string;
  points: RnGpsPoint[];
}

export interface RnTrackVariantDoc {
  rnTrackId: string;
  rnTrackName: string;
  rnVariantId: string;
  variantName: string;
  distanceM: number;
  widthM: number;
  trackType: number; // 0=Normal, 1=Rally
  /** Raw <trackDataXml><definition> XML string */
  rawDefinitionXml: string;
  /** First curve polyline — used as centreline for DB storage */
  centrelinePoints: RnGpsPoint[];
  startLinePoints: RnGpsPoint[];
  endLinePoints: RnGpsPoint[];
  sectorLines: RnSectorLine[];
  curves: RnCurve[];
}

export interface RnDriverDoc {
  rnDriverId: number;
  name: string;
  surname?: string | undefined;
}

export interface RnEventDoc {
  rnEventId: number;
  name: string;
  eventType: number;
  startTime: Date;
  endTime?: Date | undefined;
}

export interface RnSmSample {
  rnId: number;
  measuredAt: Date;
  latitude: number;
  longitude: number;
  altitudeM: number;
  directionDeg: number;
  gpsSpeedKph: number;
  gpsPosDeviationCm: number;
  gpsAccuracy: number;
  isGpsValid: boolean;
  isPositionCalculated: boolean;
  lateralG: number;
  longitudinalG: number;
  verticalG: number;
  pitchRateDs: number;
  rollRateDs: number;
  yawRateDs: number;
  isGyroValid: boolean;
  distanceMm: number;
  distanceOffsetMm: number;
  rpm: number;
  throttlePct: number;
  obdSpeedKph: number;
  oilTempC: number;
  coolantTempC: number;
  isObdValid: boolean;
  gear?: number | undefined;
  steeringAngle?: number | undefined;
  brakePct?: number | undefined;
  oilPressureBar?: number | undefined;
  measurementNumber: number;
}

export interface RnLapDoc {
  rnSourceLapId: number;
  lapNumber: number;
  lapType: number;
  startTime: Date;
  endTime?: Date | undefined;
  isStartLineCrossed: boolean;
  isEndLineCrossed: boolean;
  lapTimeMs?: number | undefined;
  vehicleNumber: string;
  vehicleModel: string;
}

export interface RnDeviceDoc {
  deviceName: string;            // e.g. "RNPRO-383"
  deviceType?: string | undefined; // e.g. "RNPRO"
}

export interface RnXmlDoc {
  device: RnDeviceDoc;
  exportDeviceName?: string | undefined;
  exportDeviceVersion?: string | undefined;
  exportDeviceTime?: Date | undefined;
  lap: RnLapDoc;
  driver: RnDriverDoc;
  event: RnEventDoc;
  trackVariant: RnTrackVariantDoc;
  measurements: RnSmSample[];
}

export interface CanRow {
  rnId: bigint;
  measuredAt: Date;
  channelName: string;
  unit: string;
  value: number;
}

export interface RnzBuffers {
  rnBuffer: Buffer;
  cdrnBuffer?: Buffer | undefined;
  rnFileName: string;
  cdrnFileName?: string | undefined;
}
