import type { TrackGeometry } from "./useTrackGeometry";
import {
  buildCurvatureSegments,
  CURVATURE_COLORS_LAVA,
  CURVATURE_COLORS_GRELLO,
} from "./curvature-colors";

interface TrackSvgProps {
  geometry: TrackGeometry;
  theme: "lava" | "grello";
  transform: string;
  onHoverPoint?: (index: number | null) => void;
  hoveredPoint?: number | null;
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
  onHoverPoint,
  hoveredPoint,
}: TrackSvgProps) {
  const { centreline, boundaryLeft, boundaryRight, startLine, sectorLines, bounds } =
    geometry;
  const stops =
    theme === "lava" ? CURVATURE_COLORS_LAVA : CURVATURE_COLORS_GRELLO;

  const vbX = bounds.minX;
  const vbY = -bounds.maxY;
  const vbW = bounds.maxX - bounds.minX;
  const vbH = bounds.maxY - bounds.minY;

  // Build curvature-colored centreline segments
  const segments = buildCurvatureSegments(
    centreline.map((n) => n.pos),
    centreline.map((n) => n.curvature),
    stops
  );

  // Track surface polygon: left boundary forward + right boundary reversed
  const surfacePoints = [
    ...boundaryLeft.map((p) => `${p.x},${-p.y}`),
    ...[...boundaryRight].reverse().map((p) => `${p.x},${-p.y}`),
  ].join(" ");

  return (
    <svg
      className="track-svg"
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={transform}>
        {/* Track surface ribbon */}
        <polygon className="track-surface" points={surfacePoints} />

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

        {/* Curvature-coded centreline segments */}
        {segments.map((seg, i) => (
          <polyline
            key={i}
            className="track-centreline-segment"
            points={seg.points}
            stroke={seg.color}
            fill="none"
          />
        ))}

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
            if (onHoverPoint) {
              const idx = findNearestPointIndex(e, centreline);
              onHoverPoint(idx);
            }
          }}
          onMouseLeave={() => onHoverPoint?.(null)}
        />
      </g>
    </svg>
  );
}
