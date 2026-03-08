interface TrackThumbnailProps {
  outline: {
    points: Array<{ x: number; y: number }>;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  };
}

export function TrackThumbnail({ outline }: TrackThumbnailProps) {
  const { points, bounds } = outline;
  const bW = bounds.maxX - bounds.minX;
  const bH = bounds.maxY - bounds.minY;

  // SVG y-axis is inverted relative to Cartesian
  const svgPoints = points.map((p) => `${p.x},${-p.y}`).join(" ");

  return (
    <svg
      className="track-thumbnail"
      viewBox={`${bounds.minX} ${-bounds.maxY} ${bW} ${bH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <polyline
        className="track-thumbnail-line"
        points={svgPoints}
        fill="none"
      />
    </svg>
  );
}
