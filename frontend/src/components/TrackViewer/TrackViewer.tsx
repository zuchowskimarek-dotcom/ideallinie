import { useState, useMemo, useRef, useEffect } from "react";
import type { TrackData } from "../../types";
import { useTrackGeometry } from "./useTrackGeometry";
import { TrackSvg } from "./TrackSvg";
import { PointInspector } from "./PointInspector";
import { ElevationProfile } from "./ElevationProfile";
import { usePanZoom } from "./usePanZoom";

interface TrackViewerProps {
  track: TrackData;
  theme: "lava" | "grello";
  onBack: () => void;
}

export function TrackViewer({ track, theme, onBack }: TrackViewerProps) {
  const { geometry, loading, error } = useTrackGeometry(track.id);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { transform, handlers, reset, ensureVisible } = usePanZoom(canvasRef);
  const [hoveredS, setHoveredS] = useState<number | null>(null);
  const [showElevationTint, setShowElevationTint] = useState(false);

  // Derive centreline index from hoveredS
  const hoveredPoint = useMemo(() => {
    if (hoveredS == null || !geometry) return null;
    const cl = geometry.centreline;
    let best = 0;
    let bestDist = Math.abs(cl[0]!.s - hoveredS);
    for (let i = 1; i < cl.length; i++) {
      const d = Math.abs(cl[i]!.s - hoveredS);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }, [hoveredS, geometry]);

  // Derive elevation for hovered point
  const hoveredElevation = useMemo(() => {
    if (hoveredPoint == null || !geometry?.centrelineElevation) return null;
    return geometry.centrelineElevation[hoveredPoint] ?? null;
  }, [hoveredPoint, geometry]);

  const hasElevation = !!geometry?.elevationProfile;

  // Auto-pan the canvas so the hovered reference point is always visible
  useEffect(() => {
    if (hoveredPoint == null || !geometry) return;
    const pt = geometry.centreline[hoveredPoint];
    if (!pt) return;
    const b = geometry.bounds;
    const vb = { x: b.minX, y: -b.maxY, w: b.maxX - b.minX, h: b.maxY - b.minY };
    ensureVisible(pt.pos.x, -pt.pos.y, vb, canvasRef.current, 20);
  }, [hoveredPoint, geometry, ensureVisible]);

  return (
    <div className="track-viewer-4panel">
      {/* Header — spans full width */}
      <div className="track-viewer-header">
        <button className="btn btn-ghost" onClick={onBack}>
          &larr; Back
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {hasElevation && (
            <button
              className={`btn btn-ghost elevation-toggle ${showElevationTint ? "active" : ""}`}
              onClick={() => setShowElevationTint((v) => !v)}
              title="Toggle elevation shading"
            >
              Tint
            </button>
          )}
          <button className="btn btn-ghost" onClick={reset}>
            Reset View
          </button>
        </div>
      </div>

      {/* Main content area: left panel + canvas + right panel */}
      <div className="track-viewer-body">
        {/* Left panel — Point Inspector */}
        <div className="track-viewer-left">
          {geometry && (
            <PointInspector
              point={hoveredPoint != null ? geometry.centreline[hoveredPoint]! : null}
              elevation={hoveredElevation}
            />
          )}
        </div>

        {/* Center — Track SVG Canvas */}
        <div
          ref={canvasRef}
          className="track-viewer-canvas"
          {...handlers}
        >
          {loading && (
            <div className="track-viewer-loading">
              <span className="spin">&orarr;</span>
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
              onHoverS={setHoveredS}
              hoveredPoint={hoveredPoint}
              showElevationTint={showElevationTint}
            />
          )}
        </div>

        {/* Right panel — coaching placeholder */}
        <div className="track-viewer-right">
          <span className="track-viewer-right-label">Coaching</span>
          <div className="track-viewer-right-placeholder">
            <span className="track-viewer-right-placeholder-icon">💬</span>
            <span className="track-viewer-right-placeholder-text">
              AI coaching stream will appear here
            </span>
          </div>
        </div>
      </div>

      {/* Bottom panel — Elevation Profile Strip (curvature fallback if no elevation) */}
      {geometry && (
        <ElevationProfile
          elevationProfile={geometry.elevationProfile ?? geometry.centreline.map((n) => ({
            s: n.s,
            altitudeM: Math.abs(n.curvature) * 1000,
          }))}
          totalDistanceM={geometry.distanceM}
          hoveredS={hoveredS}
          onHoverS={setHoveredS}
          isCurvatureFallback={!hasElevation}
        />
      )}
    </div>
  );
}
