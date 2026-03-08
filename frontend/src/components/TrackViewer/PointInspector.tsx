interface PointInspectorProps {
  point: {
    s: number;
    heading: number;
    curvature: number;
  } | null;
  elevation: number | null;
}

export function PointInspector({
  point,
  elevation,
}: PointInspectorProps) {
  const headingDeg = point
    ? ((point.heading * 180) / Math.PI).toFixed(1)
    : "—";
  const absK = point ? Math.abs(point.curvature) : 0;
  const curvatureDisplay = !point
    ? "—"
    : absK < 0.001
      ? "Straight"
      : `R = ${(1 / absK).toFixed(0)}m`;
  const direction = !point
    ? ""
    : point.curvature > 0.001
      ? "L "
      : point.curvature < -0.001
        ? "R "
        : "";

  return (
    <div className="point-inspector">
      <div className="point-inspector-header">
        <span className="point-inspector-title">Reference Point</span>
      </div>

      {!point && (
        <div className="point-inspector-hint">
          Hover over the track to inspect
        </div>
      )}

      {point && (
        <div className="point-inspector-section">
          <div className="point-inspector-row">
            <span className="point-inspector-label">Distance</span>
            <span className="point-inspector-value mono">
              {point.s.toFixed(0)} m
            </span>
          </div>
          <div className="point-inspector-row">
            <span className="point-inspector-label">Heading</span>
            <span className="point-inspector-value mono">{headingDeg}&deg;</span>
          </div>
          <div className="point-inspector-row">
            <span className="point-inspector-label">Curvature</span>
            <span className="point-inspector-value mono">
              {direction}{curvatureDisplay}
            </span>
          </div>
          {elevation != null && (
            <div className="point-inspector-row">
              <span className="point-inspector-label">Elevation</span>
              <span className="point-inspector-value mono">
                {elevation.toFixed(1)} m
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
