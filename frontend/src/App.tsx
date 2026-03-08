import { useState } from "react";
import "./index.css";
import { useTheme } from "./hooks/useTheme";
import { useServiceStatuses } from "./hooks/useServiceStatuses";
import { useTracks } from "./hooks/useTracks";
import { SettingsPanel } from "./components/SettingsPanel";
import { TrackCard } from "./components/TrackCard";
import { ImportPanel } from "./components/ImportPanel";
import { TrackViewer } from "./components/TrackViewer/TrackViewer";
import { FEATURES } from "./config";
import type { Tab, TrackData } from "./types";

export function App() {
  const { theme, setTheme } = useTheme();
  const statuses = useServiceStatuses();
  const { tracks, loading: tracksLoading } = useTracks();
  const [activeTab, setActiveTab] = useState<Tab>("tracks");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<TrackData | null>(null);

  const anyError = Object.values(statuses).some((s) => s === "unreachable");

  // Full-page track detail view
  if (selectedTrack) {
    return (
      <div className="app-shell" data-theme={theme}>
        <TrackViewer
          track={selectedTrack}
          theme={theme}
          onBack={() => setSelectedTrack(null)}
        />
      </div>
    );
  }

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
                tracks.map((t) => (
                  <TrackCard
                    key={t.id}
                    track={t}
                    onClick={() => setSelectedTrack(t)}
                  />
                ))
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
