export interface CurvatureColorStop {
  threshold: number;
  color: string;
}

export const CURVATURE_COLORS_LAVA: CurvatureColorStop[] = [
  { threshold: 0.0, color: "#444444" },   // straight — grey
  { threshold: 0.003, color: "#FF7A47" }, // gentle — accent
  { threshold: 0.01, color: "#FFD700" },  // medium — gold
  { threshold: 0.025, color: "#FF4444" }, // tight — red
  { threshold: 0.05, color: "#FF0066" },  // hairpin — hot pink
];

export const CURVATURE_COLORS_GRELLO: CurvatureColorStop[] = [
  { threshold: 0.0, color: "#444444" },
  { threshold: 0.003, color: "#BBFF33" },
  { threshold: 0.01, color: "#FFD700" },
  { threshold: 0.025, color: "#FF4444" },
  { threshold: 0.05, color: "#FF0066" },
];

function interpolateColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function getCurvatureColor(kappa: number, stops: CurvatureColorStop[]): string {
  const absK = Math.abs(kappa);
  if (absK <= stops[0]!.threshold) return stops[0]!.color;
  for (let i = 1; i < stops.length; i++) {
    if (absK <= stops[i]!.threshold) {
      const t = (absK - stops[i - 1]!.threshold) / (stops[i]!.threshold - stops[i - 1]!.threshold);
      return interpolateColor(stops[i - 1]!.color, stops[i]!.color, t);
    }
  }
  return stops[stops.length - 1]!.color;
}

/**
 * Build SVG polyline segments grouped by curvature color.
 * Adjacent points with the same color bucket are merged into one segment.
 */
export function buildCurvatureSegments(
  points: Array<{ x: number; y: number }>,
  curvatures: number[],
  stops: CurvatureColorStop[]
): Array<{ points: string; color: string }> {
  if (points.length < 2) return [];

  const segments: Array<{ points: string; color: string }> = [];
  let currentColor = getCurvatureColor(curvatures[0]!, stops);
  let currentPts: string[] = [`${points[0]!.x},${-points[0]!.y}`];

  for (let i = 1; i < points.length; i++) {
    const color = getCurvatureColor(curvatures[i]!, stops);
    const ptStr = `${points[i]!.x},${-points[i]!.y}`;

    if (color !== currentColor) {
      // End current segment at this point, start new one
      currentPts.push(ptStr);
      segments.push({ points: currentPts.join(" "), color: currentColor });
      currentColor = color;
      currentPts = [ptStr];
    } else {
      currentPts.push(ptStr);
    }
  }

  if (currentPts.length >= 2) {
    segments.push({ points: currentPts.join(" "), color: currentColor });
  }

  return segments;
}
