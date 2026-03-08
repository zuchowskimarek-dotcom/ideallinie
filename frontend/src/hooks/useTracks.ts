import { useEffect, useState } from "react";
import type { TrackData } from "../types";

export function useTracks() {
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:3000/api/tracks")
      .then((r) => r.json())
      .then((json) => {
        setTracks(json.data || []);
      })
      .catch((err) => {
        console.error("Failed to fetch tracks:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { tracks, loading, error };
}
