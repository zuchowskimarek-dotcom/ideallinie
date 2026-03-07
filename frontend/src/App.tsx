import { useEffect, useState } from "react";
import type { VehicleClass } from "@rn-ideallinie/shared-types";

export function App() {
  const [gatewayStatus, setGatewayStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { status?: string }) => setGatewayStatus(d.status ?? "unknown"))
      .catch(() => setGatewayStatus("unreachable"));
  }, []);

  const vehicleClasses: VehicleClass[] = [
    "point_mass",
    "fwd",
    "rwd",
    "awd",
    "formula",
    "gt",
    "custom",
  ];

  return (
    <div style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>RN Ideallinie</h1>
      <p>Ideal Racing Line Platform</p>
      <hr />
      <h2>System Status</h2>
      <p>
        API Gateway: <code>{gatewayStatus}</code>
      </p>
      <h2>Available Vehicle Classes</h2>
      <ul>
        {vehicleClasses.map((vc) => (
          <li key={vc}>
            <code>{vc}</code>
          </li>
        ))}
      </ul>
      <p style={{ color: "#888", marginTop: "2rem" }}>
        Sprint 0 scaffold. Track visualization coming in Sprint 4.
      </p>
    </div>
  );
}
