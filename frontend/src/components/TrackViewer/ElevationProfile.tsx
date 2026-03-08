import { useRef, useMemo } from "react";

interface ElevationProfileProps {
  elevationProfile: Array<{ s: number; altitudeM: number }>;
  totalDistanceM: number;
  hoveredS: number | null;
  onHoverS: (s: number | null) => void;
  isCurvatureFallback?: boolean;
}

const PADDING = { top: 16, bottom: 20, left: 48, right: 16 };
const CHART_HEIGHT = 120;

export function ElevationProfile({
  elevationProfile,
  totalDistanceM,
  hoveredS,
  onHoverS,
  isCurvatureFallback = false,
}: ElevationProfileProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { minAlt, maxAlt, areaPath, linePath } = useMemo(() => {
    if (elevationProfile.length === 0) {
      return { minAlt: 0, maxAlt: 0, areaPath: "", linePath: "" };
    }

    let min = Infinity;
    let max = -Infinity;
    for (const p of elevationProfile) {
      if (p.altitudeM < min) min = p.altitudeM;
      if (p.altitudeM > max) max = p.altitudeM;
    }
    // Add some padding to Y range
    const range = max - min || 1;
    min -= range * 0.05;
    max += range * 0.05;

    const chartW = 1000 - PADDING.left - PADDING.right;
    const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const toX = (s: number) =>
      PADDING.left + (s / totalDistanceM) * chartW;
    const toY = (alt: number) =>
      PADDING.top + chartH - ((alt - min) / (max - min)) * chartH;

    // Build SVG paths
    const linePoints = elevationProfile
      .map((p) => `${toX(p.s).toFixed(1)},${toY(p.altitudeM).toFixed(1)}`)
      .join(" ");

    const baseline = PADDING.top + chartH;
    const firstX = toX(elevationProfile[0]!.s);
    const lastX = toX(elevationProfile[elevationProfile.length - 1]!.s);

    const areaD = `M${firstX},${baseline} L${linePoints
      .split(" ")
      .map((pt) => `L${pt}`)
      .join(" ")} L${lastX},${baseline} Z`;

    const lineD = `M${linePoints.split(" ").join(" L")}`;

    return { minAlt: min, maxAlt: max, areaPath: areaD, linePath: lineD };
  }, [elevationProfile, totalDistanceM]);

  // Hover crosshair position
  const hoveredPos = useMemo(() => {
    if (hoveredS == null || elevationProfile.length === 0) return null;

    const chartW = 1000 - PADDING.left - PADDING.right;
    const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    const x = PADDING.left + (hoveredS / totalDistanceM) * chartW;

    // Find altitude at hoveredS via linear search
    let alt = elevationProfile[0]!.altitudeM;
    for (let i = 1; i < elevationProfile.length; i++) {
      if (elevationProfile[i]!.s >= hoveredS) {
        const prev = elevationProfile[i - 1]!;
        const next = elevationProfile[i]!;
        const ds = next.s - prev.s;
        const t = ds > 0 ? (hoveredS - prev.s) / ds : 0;
        alt = prev.altitudeM + t * (next.altitudeM - prev.altitudeM);
        break;
      }
    }
    if (hoveredS >= elevationProfile[elevationProfile.length - 1]!.s) {
      alt = elevationProfile[elevationProfile.length - 1]!.altitudeM;
    }

    const range = maxAlt - minAlt || 1;
    const y =
      PADDING.top +
      (CHART_HEIGHT - PADDING.top - PADDING.bottom) -
      ((alt - minAlt) / range) *
        (CHART_HEIGHT - PADDING.top - PADDING.bottom);

    return { x, y, alt };
  }, [hoveredS, elevationProfile, totalDistanceM, minAlt, maxAlt]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const chartX = xRatio * 1000;
    const chartW = 1000 - PADDING.left - PADDING.right;
    const s = ((chartX - PADDING.left) / chartW) * totalDistanceM;
    if (s >= 0 && s <= totalDistanceM) {
      onHoverS(s);
    }
  };

  const handleMouseLeave = () => onHoverS(null);

  return (
    <div className="elevation-profile">
      <svg
        ref={svgRef}
        className="elevation-profile-svg"
        viewBox={`0 0 1000 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Area fill */}
        <path className="elevation-profile-area" d={areaPath} />

        {/* Line stroke */}
        <path className="elevation-profile-line" d={linePath} />

        {/* Y-axis labels (only for real elevation data) */}
        {!isCurvatureFallback && (
          <>
            <text
              className="elevation-profile-label"
              x={PADDING.left - 4}
              y={PADDING.top + 4}
              textAnchor="end"
            >
              {maxAlt.toFixed(0)}m
            </text>
            <text
              className="elevation-profile-label"
              x={PADDING.left - 4}
              y={CHART_HEIGHT - PADDING.bottom}
              textAnchor="end"
            >
              {minAlt.toFixed(0)}m
            </text>
          </>
        )}

        {/* Title */}
        <text
          className="elevation-profile-title"
          x={PADDING.left}
          y={CHART_HEIGHT - 4}
        >
          {isCurvatureFallback ? "Curvature" : "Elevation"}
        </text>

        {/* Distance label */}
        <text
          className="elevation-profile-label"
          x={1000 - PADDING.right}
          y={CHART_HEIGHT - 4}
          textAnchor="end"
        >
          {(totalDistanceM / 1000).toFixed(1)} km
        </text>

        {/* Hover crosshair */}
        {hoveredPos && (
          <>
            <line
              className="elevation-profile-crosshair"
              x1={hoveredPos.x}
              y1={PADDING.top}
              x2={hoveredPos.x}
              y2={CHART_HEIGHT - PADDING.bottom}
            />
            <circle
              className="elevation-profile-dot"
              cx={hoveredPos.x}
              cy={hoveredPos.y}
              r={4}
            />
            {!isCurvatureFallback && (
              <text
                className="elevation-profile-label"
                x={hoveredPos.x + 6}
                y={hoveredPos.y - 6}
              >
                {hoveredPos.alt.toFixed(1)}m
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
