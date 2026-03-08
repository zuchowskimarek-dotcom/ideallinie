import { useState, useEffect } from "react";

export interface TrackGeometry {
  variantId: string;
  variantName: string;
  distanceM: number;
  widthM: number;
  centreline: Array<{
    s: number;
    pos: { x: number; y: number };
    heading: number;
    curvature: number;
  }>;
  boundaryLeft: Array<{ x: number; y: number }>;
  boundaryRight: Array<{ x: number; y: number }>;
  startLine: { label: string; left: { x: number; y: number }; centre: { x: number; y: number }; right: { x: number; y: number } } | null;
  endLine: { label: string; left: { x: number; y: number }; centre: { x: number; y: number }; right: { x: number; y: number } } | null;
  sectorLines: Array<{ label: string; left: { x: number; y: number }; centre: { x: number; y: number }; right: { x: number; y: number } }>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

interface UseTrackGeometryResult {
  geometry: TrackGeometry | null;
  loading: boolean;
  error: string | null;
}

export function useTrackGeometry(variantId: string): UseTrackGeometryResult {
  const [geometry, setGeometry] = useState<TrackGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setGeometry(null);
    fetch(`http://localhost:3000/api/tracks/${variantId}/geometry`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setGeometry(json.data);
        else setError(json.message || "No geometry data");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [variantId]);

  return { geometry, loading, error };
}
