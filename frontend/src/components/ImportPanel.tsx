import { useRef, useState } from "react";
import type { ImportResult } from "../types";

export function ImportPanel() {
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
