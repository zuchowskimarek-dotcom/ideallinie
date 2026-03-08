import { useEffect, useRef, useState } from "react";
import "./index.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Theme = "lava" | "grello";
type ServiceStatus = "checking" | "ok" | "unreachable";
type Tab = "tracks" | "cars" | "drivers" | "services";

interface ServiceInfo {
  name: string;
  port: number;
  url: string;
  description: string;
  icon: string;
}

interface ImportResult {
  status: string;
  lapId: string;
  rnSourceLapId: number;
  track: { id: string; name: string; variantName: string; variantVersion: number; action: string };
  lap: { lapNumber: number; startTime: string; lapTimeMs: number | null };
  counts: { measurements: number; canRecords: number };
}

interface TrackData {
  id: string;
  name: string;
  location: string;
  countryCode: string;
  image: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SERVICES: ServiceInfo[] = [
  {
    name: "API Gateway",
    port: 3000,
    url: "http://localhost:3000/health",
    description: "Request routing and proxy",
    icon: "⬡",
  },
  {
    name: "Solver Service",
    port: 8001,
    url: "http://localhost:8001/health",
    description: "Racing line optimisation engine",
    icon: "◎",
  },
  {
    name: "Track Service",
    port: 8002,
    url: "http://localhost:8002/health",
    description: "Track geometry and variants",
    icon: "◈",
  },
  {
    name: "Trajectory Service",
    port: 8003,
    url: "http://localhost:8003/health",
    description: "Recorded trajectory storage",
    icon: "⟳",
  },
  {
    name: "RNZ Importer",
    port: 8004,
    url: "http://localhost:8004/health",
    description: "Race Navigator file ingestion",
    icon: "⬆",
  },
];

const MOCK_TRACKS: TrackData[] = [
  { id: "1", name: "Nürburgring Nordschleife", location: "Nürburg, Germany", countryCode: "DE", image: "/track-placeholder.png" },
  { id: "2", name: "Circuit de Spa-Francorchamps", location: "Stavelot, Belgium", countryCode: "BE", image: "/track-placeholder.png" },
  { id: "3", name: "Red Bull Ring", location: "Spielberg, Austria", countryCode: "AT", image: "/track-placeholder.png" },
  { id: "4", name: "Autodromo Nazionale Monza", location: "Monza, Italy", countryCode: "IT", image: "/track-placeholder.png" },
  { id: "5", name: "Suzuka Circuit", location: "Suzuka, Japan", countryCode: "JP", image: "/track-placeholder.png" },
  { id: "6", name: "Mount Panorama", location: "Bathurst, Australia", countryCode: "AU", image: "/track-placeholder.png" },
];

const FEATURES = [
  {
    icon: "◎",
    title: "Ideal Line Solver",
    desc: "Optimal racing line computation using minimum curvature and lap-time algorithms.",
    tag: "Sprint 4",
  },
  {
    icon: "◈",
    title: "Track Library",
    desc: "Browse and manage track layouts, variants, corridors, and centrelines.",
    tag: "Sprint 3",
  },
  {
    icon: "⬡",
    title: "Telemetry Viewer",
    desc: "Overlay GPS measurements, speed, G-forces, and CAN signals on track maps.",
    tag: "Sprint 5",
  },
  {
    icon: "⟳",
    title: "Lap Comparison",
    desc: "Compare recorded trajectories sector by sector against the ideal line.",
    tag: "Sprint 6",
  },
];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("ideallinie-theme") as Theme) || "lava";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ideallinie-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

function useServiceStatuses() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>(
    Object.fromEntries(SERVICES.map((s) => [s.name, "checking"]))
  );

  useEffect(() => {
    const check = () => {
      SERVICES.forEach(({ name, url }) => {
        fetch(url)
          .then((r) => (r.ok ? "ok" : "unreachable"))
          .catch(() => "unreachable" as ServiceStatus)
          .then((status) =>
            setStatuses((prev) => ({ ...prev, [name]: status as ServiceStatus }))
          );
      });
    };
    check();
    const inv = setInterval(check, 5000);
    return () => clearInterval(inv);
  }, []);

  return statuses;
}

function useTracks() {
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

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === "checking") {
    return (
      <span className="badge badge-checking">
        <span className="badge-dot badge-dot-pulse" />
        checking
      </span>
    );
  }
  return (
    <span className={`badge ${status === "ok" ? "badge-ok" : "badge-err"}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

function SettingsPanel({
  isOpen,
  onClose,
  theme,
  setTheme,
  statuses,
}: {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  statuses: Record<string, ServiceStatus>;
}) {
  return (
    <>
      <div className={`settings-overlay ${isOpen ? "open" : ""}`} onClick={onClose} />
      <div className={`settings-panel ${isOpen ? "open" : ""}`}>
        <div className="settings-header">
          <h2 className="settings-title">System Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-group">
          <span className="settings-label">Interface Theme</span>
          <div className="theme-toggle">
            <button
              className={`theme-btn ${theme === "lava" ? "active" : ""}`}
              onClick={() => setTheme("lava")}
            >
              <span>Lava Orange</span>
              <span className="theme-dot theme-dot-lava" />
            </button>
            <button
              className={`theme-btn ${theme === "grello" ? "active" : ""}`}
              onClick={() => setTheme("grello")}
            >
              <span>Grello Green</span>
              <span className="theme-dot theme-dot-grello" />
            </button>
          </div>
        </div>

        <div className="settings-group">
          <span className="settings-label">Microservices Status</span>
          <div className="service-list">
            {SERVICES.map((svc) => (
              <div key={svc.name} className="service-row">
                <div className="service-info">
                  <span style={{ fontSize: 16, color: "var(--accent-text)" }}>{svc.icon}</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span className="service-name">{svc.name}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Port {svc.port}</span>
                  </div>
                </div>
                <StatusBadge status={statuses[svc.name] || "unreachable"} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid var(--border-subtle)", fontSize: 11, color: "var(--text-muted)" }}>
          RN Ideallinie · Platform Core v0.5.0
        </div>
      </div>
    </>
  );
}

function TrackCard({ track }: { track: TrackData }) {
  return (
    <div className="track-card">
      <div className="track-card-img" style={{ backgroundImage: `url(${track.image})` }} />
      <div className="track-card-overlay">
        <div className="track-location">
          <div className="track-flag" />
          {track.location}
        </div>
        <div className="track-name">{track.name}</div>
      </div>
    </div>
  );
}

function ImportPanel() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".rnz")) {
      setError("Only .rnz files are supported.");
      return;
    }
    setError(null);
    setResult(null);
    setUploading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      // Proxy through API gateway on port 3000
      const res = await fetch("http://localhost:3000/api/import/rnz", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data: ImportResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Telemetry Ingestion</span>
      </div>

      <div
        className={`upload-zone ${dragging ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".rnz"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div className="upload-zone-icon">{uploading ? "⟳" : "📦"}</div>
        <div className="upload-zone-title">
          {uploading ? <span className="spin">⟳</span> : "Race Navigator (.RNZ)"}
        </div>
        <div className="upload-zone-hint">
          {uploading ? "Parsing telemetry archive..." : "Drop here or click to select archive"}
        </div>
      </div>

      {error && (
        <div className="result-box" style={{ borderColor: "var(--status-err)", marginTop: 12 }}>
          <div className="result-title" style={{ color: "var(--status-err)" }}>✕ IMPORT FAILED</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{error}</div>
        </div>
      )}

      {result && (
        <div className="result-box">
          <div className="result-title">✓ IMPORT SUCCESSFUL</div>
          <div className="result-grid">
            <div className="result-stat"><div className="result-stat-label">Track</div><div className="result-stat-value">{result.track.name}</div></div>
            <div className="result-stat"><div className="result-stat-label">Lap</div><div className="result-stat-value accent">#{result.lap.lapNumber}</div></div>
            <div className="result-stat"><div className="result-stat-label">Measure</div><div className="result-stat-value accent">{result.counts.measurements}</div></div>
            <div className="result-stat"><div className="result-stat-label">CAN</div><div className="result-stat-value accent">{result.counts.canRecords}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export function App() {
  const { theme, setTheme } = useTheme();
  const statuses = useServiceStatuses();
  const { tracks, loading: tracksLoading } = useTracks();
  const [activeTab, setActiveTab] = useState<Tab>("tracks");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const anyError = Object.values(statuses).some((s) => s === "unreachable");

  return (
    <div className="app-shell" data-theme={theme}>
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-logo">
          <div className="logo-badge">IL</div>
          <span className="logo-name">IDEALLINIE</span>
        </div>

        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setIsSettingsOpen(true)}>
            <span style={{ fontSize: 16 }}>⚙</span>
            Settings
            {anyError && (
              <span className="badge-dot" style={{ backgroundColor: "var(--status-err)" }} />
            )}
          </button>
        </div>
      </header>

      {/* Gaming Tabs */}
      <div className="tabs-container">
        <nav className="tab-bar">
          <button className={`tab-btn ${activeTab === "tracks" ? "active" : ""}`} onClick={() => setActiveTab("tracks")}>Tracks</button>
          <button className={`tab-btn ${activeTab === "cars" ? "active" : ""}`} onClick={() => setActiveTab("cars")}>Cars</button>
          <button className={`tab-btn ${activeTab === "drivers" ? "active" : ""}`} onClick={() => setActiveTab("drivers")}>Drivers</button>
          <button className={`tab-btn ${activeTab === "services" ? "active" : ""}`} onClick={() => setActiveTab("services")}>Services</button>
        </nav>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        statuses={statuses}
      />

      <main className="main-content">
        {activeTab === "tracks" && (
          <div className="fade-in">
            <div className="page-header">
              <h1 className="page-title">Track Library</h1>
              <p className="page-subtitle">Select a circuit to view telemetry or solve for the ideal line</p>
            </div>
            <div className="track-grid">
              {tracksLoading ? (
                <div style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center", padding: "40px" }}>
                  <span className="spin" style={{ display: "inline-block", marginRight: 8 }}>⟳</span>
                  Loading track library...
                </div>
              ) : tracks.length > 0 ? (
                tracks.map(t => <TrackCard key={t.id} track={t} />)
              ) : (
                <div style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center", padding: "40px" }}>
                  No tracks found in library. Import an .RNZ file to start.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "cars" && (
          <div className="placeholder-view">
            <div className="placeholder-icon">🏎</div>
            <div className="coming-soon-badge">Coming Soon</div>
            <p>Garage and vehicle telemetry profiles</p>
          </div>
        )}

        {activeTab === "drivers" && (
          <div className="placeholder-view">
            <div className="placeholder-icon">👤</div>
            <div className="coming-soon-badge">Coming Soon</div>
            <p>Driver performance analytics and comparisons</p>
          </div>
        )}

        {activeTab === "services" && (
          <div className="fade-in">
            <div className="page-header">
              <h1 className="page-title">Platform Services</h1>
              <p className="page-subtitle">Manage service modules and data ingestion pipelines</p>
            </div>

            <div className="section">
              <div className="section-header"><span className="section-title">Core Modules</span></div>
              <div className="card-grid">
                {FEATURES.map((f) => (
                  <div className="card" key={f.title}>
                    <div className="card-header">
                      <div className="card-icon">{f.icon}</div>
                      <span className="badge badge-accent" style={{ fontSize: 10 }}>{f.tag}</span>
                    </div>
                    <div className="card-title">{f.title}</div>
                    <div className="card-desc">{f.desc}</div>
                    <div className="card-footer">
                      <span className="card-link">Configure Module →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ margin: "40px 0", height: 1, background: "var(--border-subtle)" }} />

            <ImportPanel />
          </div>
        )}
      </main>

      <footer style={{ padding: "40px 0", textAlign: "center", borderTop: "1px solid var(--border-subtle)" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em" }}>
          Next-Gen Racing Intelligence · Macrix RN
        </p>
      </footer>
    </div>
  );
}
