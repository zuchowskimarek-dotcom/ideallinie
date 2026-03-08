import { useMemo } from "react";
import type { TrackGeometry } from "./useTrackGeometry";

interface TrackSvgProps {
  geometry: TrackGeometry;
  theme: "lava" | "grello";
  transform: string;
  onHoverS?: (s: number | null) => void;
  hoveredPoint?: number | null;
  showElevationTint?: boolean;
}

function toSvgPoints(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x},${-p.y}`).join(" ");
}

function findNearestPointIndex(
  e: React.MouseEvent<SVGPolylineElement>,
  centreline: TrackGeometry["centreline"]
): number {
  const svg = (e.target as SVGElement).closest("svg")!;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());

  let minDist = Infinity;
  let minIdx = 0;
  centreline.forEach((node, i) => {
    const dx = node.pos.x - svgPt.x;
    const dy = -node.pos.y - svgPt.y;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  });
  return minIdx;
}

export function TrackSvg({
  geometry,
  theme,
  transform,
  onHoverS,
  hoveredPoint,
  showElevationTint,
}: TrackSvgProps) {
  const { centreline, boundaryLeft, boundaryRight, startLine, sectorLines, bounds } =
    geometry;

  const vbX = bounds.minX;
  const vbY = -bounds.maxY;
  const vbW = bounds.maxX - bounds.minX;
  const vbH = bounds.maxY - bounds.minY;

  // Track surface polygon: left boundary forward + right boundary reversed
  const surfacePoints = [
    ...boundaryLeft.map((p) => `${p.x},${-p.y}`),
    ...[...boundaryRight].reverse().map((p) => `${p.x},${-p.y}`),
  ].join(" ");

  // Elevation tint quads
  const elevationQuads = useMemo(() => {
    if (!showElevationTint || !geometry.centrelineElevation) return null;

    const elev = geometry.centrelineElevation;
    let minAlt = Infinity;
    let maxAlt = -Infinity;
    for (const v of elev) {
      if (v != null) {
        if (v < minAlt) minAlt = v;
        if (v > maxAlt) maxAlt = v;
      }
    }
    const range = maxAlt - minAlt || 1;

    const quads: Array<{ points: string; opacity: number }> = [];
    for (let i = 0; i < centreline.length - 1; i++) {
      const alt = elev[i] ?? minAlt;
      const t = (alt - minAlt) / range;
      const opacity = 0.03 + 0.09 * t;
      const pts = [
        `${boundaryLeft[i]!.x},${-boundaryLeft[i]!.y}`,
        `${boundaryLeft[i + 1]!.x},${-boundaryLeft[i + 1]!.y}`,
        `${boundaryRight[i + 1]!.x},${-boundaryRight[i + 1]!.y}`,
        `${boundaryRight[i]!.x},${-boundaryRight[i]!.y}`,
      ].join(" ");
      quads.push({ points: pts, opacity });
    }
    return quads;
  }, [showElevationTint, geometry.centrelineElevation, centreline, boundaryLeft, boundaryRight]);

  return (
    <svg
      className="track-svg"
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={transform}>
        {/* Track surface — elevation tinted or flat */}
        {elevationQuads ? (
          elevationQuads.map((q, i) => (
            <polygon
              key={`elev-${i}`}
              points={q.points}
              fill={`rgba(255, 255, 255, ${q.opacity})`}
              stroke="none"
            />
          ))
        ) : (
          <polygon className="track-surface" points={surfacePoints} />
        )}

        {/* Boundaries */}
        <polyline
          className="track-boundary"
          points={toSvgPoints(boundaryLeft)}
          fill="none"
        />
        <polyline
          className="track-boundary"
          points={toSvgPoints(boundaryRight)}
          fill="none"
        />

        {/* Sector lines */}
        {sectorLines.map((sl, i) => (
          <line
            key={`sector-${i}`}
            className="track-sector-line"
            x1={sl.left.x}
            y1={-sl.left.y}
            x2={sl.right.x}
            y2={-sl.right.y}
          />
        ))}

        {/* Start/finish line */}
        {startLine && (
          <line
            className="track-start-line"
            x1={startLine.left.x}
            y1={-startLine.left.y}
            x2={startLine.right.x}
            y2={-startLine.right.y}
          />
        )}

        {/* Hover indicator */}
        {hoveredPoint != null && centreline[hoveredPoint] && (
          <circle
            className="track-hover-dot"
            cx={centreline[hoveredPoint]!.pos.x}
            cy={-centreline[hoveredPoint]!.pos.y}
            r={3}
          />
        )}

        {/* Invisible thick centreline for mouse interaction */}
        <polyline
          className="track-centreline-hitarea"
          points={toSvgPoints(centreline.map((n) => n.pos))}
          fill="none"
          onMouseMove={(e) => {
            if (onHoverS) {
              const idx = findNearestPointIndex(e, centreline);
              onHoverS(centreline[idx]?.s ?? null);
            }
          }}
          onMouseLeave={() => onHoverS?.(null)}
        />
      </g>
    </svg>
  );
}
