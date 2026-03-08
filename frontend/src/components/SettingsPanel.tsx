import type { Theme, ServiceStatus } from "../types";
import { SERVICES } from "../config";
import { StatusBadge } from "./StatusBadge";

export function SettingsPanel({
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
