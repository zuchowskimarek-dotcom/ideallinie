import type { ServiceInfo } from "./types";

export const SERVICES: ServiceInfo[] = [
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

export const FEATURES = [
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
