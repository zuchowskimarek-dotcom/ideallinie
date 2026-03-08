import type { TrackData } from "../types";
import { TrackThumbnail } from "./TrackThumbnail";

interface TrackCardProps {
  track: TrackData;
  onClick: () => void;
}

export function TrackCard({ track, onClick }: TrackCardProps) {
  return (
    <div className="track-card" onClick={onClick}>
      {track.outline ? (
        <div className="track-card-svg">
          <TrackThumbnail outline={track.outline} />
        </div>
      ) : (
        <div className="track-card-img" style={{ backgroundImage: `url(${track.image})` }} />
      )}
      <div className="track-card-overlay">
        <div className="track-location">
          <div className="track-flag" />
          {track.location}
        </div>
        <div className="track-name">{track.name}</div>
        {track.distanceM != null && (
          <div style={{ marginTop: 4 }}>
            <span className="badge badge-accent" style={{ fontSize: 10 }}>
              {(track.distanceM / 1000).toFixed(1)} km
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
