interface TrackTooltipProps {
  point: {
    s: number;
    heading: number;
    curvature: number;
  };
  position: { x: number; y: number };
}

export function TrackTooltip({ point, position }: TrackTooltipProps) {
  const headingDeg = ((point.heading * 180) / Math.PI).toFixed(1);
  const absK = Math.abs(point.curvature);
  const curvatureDisplay =
    absK < 0.001
      ? "Straight"
      : `R = ${(1 / absK).toFixed(0)}m`;
  const direction =
    point.curvature > 0.001 ? "Left" : point.curvature < -0.001 ? "Right" : "";

  return (
    <div
      className="track-tooltip"
      style={{ left: position.x + 16, top: position.y - 10 }}
    >
      <div className="track-tooltip-row">
        <span className="track-tooltip-label">Distance</span>
        <span className="track-tooltip-value">{point.s.toFixed(0)} m</span>
      </div>
      <div className="track-tooltip-row">
        <span className="track-tooltip-label">Heading</span>
        <span className="track-tooltip-value">{headingDeg}°</span>
      </div>
      <div className="track-tooltip-row">
        <span className="track-tooltip-label">Curvature</span>
        <span className="track-tooltip-value">
          {direction} {curvatureDisplay}
        </span>
      </div>
    </div>
  );
}
