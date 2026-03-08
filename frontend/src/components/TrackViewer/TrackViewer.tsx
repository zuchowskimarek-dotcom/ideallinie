import { useState } from "react";
import type { TrackData } from "../../types";
import { useTrackGeometry } from "./useTrackGeometry";
import { TrackSvg } from "./TrackSvg";
import { TrackTooltip } from "./TrackTooltip";
import { usePanZoom } from "./usePanZoom";

interface TrackViewerProps {
  track: TrackData;
  theme: "lava" | "grello";
  onBack: () => void;
}

export function TrackViewer({ track, theme, onBack }: TrackViewerProps) {
  const { geometry, loading, error } = useTrackGeometry(track.id);
  const { transform, handlers, reset } = usePanZoom();
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  return (
    <div className="track-viewer">
      {/* Header */}
      <div className="track-viewer-header">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="track-viewer-info">
          <h1 className="track-viewer-title">{track.name}</h1>
          {geometry && (
            <div className="track-viewer-stats">
              <span className="badge badge-accent">
                {(geometry.distanceM / 1000).toFixed(1)} km
              </span>
              <span className="badge badge-accent">
                {geometry.widthM}m wide
              </span>
              <span className="badge badge-accent">
                {geometry.centreline.length} pts
              </span>
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-ghost" onClick={reset}>
            Reset View
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="track-viewer-canvas"
        {...handlers}
        onMouseMove={(e) => {
          handlers.onMouseMove(e);
          setMousePos({ x: e.clientX, y: e.clientY });
        }}
      >
        {loading && (
          <div className="track-viewer-loading">
            <span className="spin">⟳</span>
            <span style={{ marginLeft: 8 }}>Loading geometry...</span>
          </div>
        )}
        {error && (
          <div className="track-viewer-error">
            <span className="badge badge-err">Error: {error}</span>
          </div>
        )}
        {geometry && (
          <TrackSvg
            geometry={geometry}
            theme={theme}
            transform={transform}
            onHoverPoint={setHoveredPoint}
            hoveredPoint={hoveredPoint}
          />
        )}
      </div>

      {/* Tooltip */}
      {hoveredPoint != null && geometry?.centreline[hoveredPoint] && (
        <TrackTooltip
          point={geometry.centreline[hoveredPoint]!}
          position={mousePos}
        />
      )}

      {/* Curvature legend */}
      <div className="track-viewer-legend">
        <span className="track-legend-item">
          <span className="track-legend-dot" style={{ background: "#444" }} /> Straight
        </span>
        <span className="track-legend-item">
          <span className="track-legend-dot" style={{ background: "var(--accent-text)" }} /> Gentle
        </span>
        <span className="track-legend-item">
          <span className="track-legend-dot" style={{ background: "#FFD700" }} /> Medium
        </span>
        <span className="track-legend-item">
          <span className="track-legend-dot" style={{ background: "#FF4444" }} /> Tight
        </span>
        <span className="track-legend-item">
          <span className="track-legend-dot" style={{ background: "#FF0066" }} /> Hairpin
        </span>
      </div>
    </div>
  );
}
