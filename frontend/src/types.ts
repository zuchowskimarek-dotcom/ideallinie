export type Theme = "lava" | "grello";
export type ServiceStatus = "checking" | "ok" | "unreachable";
export type Tab = "tracks" | "cars" | "drivers" | "services";

export interface ServiceInfo {
  name: string;
  port: number;
  url: string;
  description: string;
  icon: string;
}

export interface ImportResult {
  status: string;
  lapId: string;
  rnSourceLapId: number;
  track: { id: string; name: string; variantName: string; variantVersion: number; action: string };
  lap: { lapNumber: number; startTime: string; lapTimeMs: number | null };
  counts: { measurements: number; canRecords: number };
}

export interface TrackData {
  id: string;
  name: string;
  location: string;
  countryCode: string;
  image: string;
  distanceM?: number;
  widthM?: number;
  outline?: {
    variantId: string;
    points: Array<{ x: number; y: number }>;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null;
}
