/**
 * Pure geometry computation functions for track rendering.
 * No Fastify or Prisma dependencies — only math.
 */
import type { Point2D, TrackPoint, RnGpsPointDto } from "@rn-ideallinie/shared-types";

const EARTH_RADIUS_M = 6_371_000;
const DEG2RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// GPS → Cartesian projection (equirectangular)
// ---------------------------------------------------------------------------

export function projectToCartesian(gpsPoints: RnGpsPointDto[]): {
  points: Point2D[];
  originLat: number;
  originLon: number;
} {
  if (gpsPoints.length === 0) return { points: [], originLat: 0, originLon: 0 };

  const latSum = gpsPoints.reduce((s, p) => s + p.latitude, 0);
  const lonSum = gpsPoints.reduce((s, p) => s + p.longitude, 0);
  const originLat = latSum / gpsPoints.length;
  const originLon = lonSum / gpsPoints.length;
  const cosLat = Math.cos(originLat * DEG2RAD);

  const points: Point2D[] = gpsPoints.map((p) => ({
    x: (p.longitude - originLon) * DEG2RAD * EARTH_RADIUS_M * cosLat,
    y: (p.latitude - originLat) * DEG2RAD * EARTH_RADIUS_M,
  }));

  return { points, originLat, originLon };
}

export function projectPoint(
  lat: number,
  lon: number,
  originLat: number,
  originLon: number
): Point2D {
  const cosLat = Math.cos(originLat * DEG2RAD);
  return {
    x: (lon - originLon) * DEG2RAD * EARTH_RADIUS_M * cosLat,
    y: (lat - originLat) * DEG2RAD * EARTH_RADIUS_M,
  };
}

// ---------------------------------------------------------------------------
// Arc-length
// ---------------------------------------------------------------------------

export function computeArcLengths(points: Point2D[]): number[] {
  const s: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    s.push(s[i - 1]! + Math.sqrt(dx * dx + dy * dy));
  }
  return s;
}

// ---------------------------------------------------------------------------
// Heading computation
// ---------------------------------------------------------------------------

/**
 * Compute heading at each point (radians, 0 = North/+Y, clockwise positive).
 * Falls back to the GPS direction field when consecutive points are too close.
 */
export function computeHeadings(
  points: Point2D[],
  gpsDirectionsDeg: number[]
): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [gpsDirectionsDeg[0]! * DEG2RAD];

  const headings: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x;
    const dy = points[i + 1]!.y - points[i]!.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) {
      // Points too close — use GPS direction
      headings.push(gpsDirectionsDeg[i]! * DEG2RAD);
    } else {
      // atan2(dx, dy) gives angle from +Y (North), clockwise positive
      headings.push(Math.atan2(dx, dy));
    }
  }
  // Last point reuses previous heading
  headings.push(headings[headings.length - 1]!);
  return headings;
}

// ---------------------------------------------------------------------------
// Curvature computation
// ---------------------------------------------------------------------------

/** Normalise angle to [-PI, PI] */
function normaliseAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Compute curvature κ(s) = dθ/ds via central finite differences.
 * Positive = left turn.
 */
export function computeCurvatures(
  headings: number[],
  arcLengths: number[]
): number[] {
  const n = headings.length;
  if (n < 2) return headings.map(() => 0);

  const kappa: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      const ds = arcLengths[1]! - arcLengths[0]!;
      const dh = normaliseAngle(headings[1]! - headings[0]!);
      kappa.push(ds > 0.01 ? dh / ds : 0);
    } else if (i === n - 1) {
      const ds = arcLengths[n - 1]! - arcLengths[n - 2]!;
      const dh = normaliseAngle(headings[n - 1]! - headings[n - 2]!);
      kappa.push(ds > 0.01 ? dh / ds : 0);
    } else {
      const ds = arcLengths[i + 1]! - arcLengths[i - 1]!;
      const dh = normaliseAngle(headings[i + 1]! - headings[i - 1]!);
      kappa.push(ds > 0.01 ? dh / ds : 0);
    }
  }
  return kappa;
}

// ---------------------------------------------------------------------------
// Polyline offset (for track boundaries)
// ---------------------------------------------------------------------------

/**
 * Offset a polyline perpendicular to its heading at each point.
 * offsetM > 0 = left of travel direction.
 *
 * With heading measured from +Y (North) clockwise:
 *   travel direction = (sin(h), cos(h))
 *   left perpendicular = (-cos(h), sin(h))
 */
export function offsetPolyline(
  points: Point2D[],
  headings: number[],
  offsetM: number
): Point2D[] {
  return points.map((pt, i) => {
    const h = headings[i]!;
    return {
      x: pt.x + (-Math.cos(h)) * offsetM,
      y: pt.y + Math.sin(h) * offsetM,
    };
  });
}

// ---------------------------------------------------------------------------
// Bounding box
// ---------------------------------------------------------------------------

export function computeBounds(
  points: Point2D[],
  padding = 10
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker polyline simplification
// ---------------------------------------------------------------------------

function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  const ex = point.x - projX;
  const ey = point.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

export function simplifyPolyline(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolyline(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPolyline(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

// ---------------------------------------------------------------------------
// Build TrackPoint array from projected data
// ---------------------------------------------------------------------------

export function buildTrackPoints(
  points: Point2D[],
  gpsDirectionsDeg: number[]
): TrackPoint[] {
  const arcLengths = computeArcLengths(points);
  const headings = computeHeadings(points, gpsDirectionsDeg);
  const curvatures = computeCurvatures(headings, arcLengths);

  return points.map((pt, i) => ({
    s: arcLengths[i]!,
    pos: pt,
    heading: headings[i]!,
    curvature: curvatures[i]!,
  }));
}

// ---------------------------------------------------------------------------
// Elevation interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate altitude values from measurement samples onto centreline points.
 * Uses binary search for O(n log m) performance.
 *
 * @param centrelineS  Arc-length values for each centreline point (metres)
 * @param samples      Sorted measurement samples with { s (metres), altitudeM }
 * @returns            Altitude per centreline point (null if no samples)
 */
export function interpolateElevation(
  centrelineS: number[],
  samples: Array<{ s: number; altitudeM: number }>
): (number | null)[] {
  if (samples.length === 0) return centrelineS.map(() => null);

  return centrelineS.map((s) => {
    // Clamp to first/last sample
    if (s <= samples[0]!.s) return samples[0]!.altitudeM;
    if (s >= samples[samples.length - 1]!.s) return samples[samples.length - 1]!.altitudeM;

    // Binary search for bracketing samples
    let lo = 0;
    let hi = samples.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid]!.s <= s) lo = mid;
      else hi = mid;
    }

    // Linear interpolation
    const ds = samples[hi]!.s - samples[lo]!.s;
    if (ds < 0.001) return samples[lo]!.altitudeM;
    const t = (s - samples[lo]!.s) / ds;
    return samples[lo]!.altitudeM + t * (samples[hi]!.altitudeM - samples[lo]!.altitudeM);
  });
}
