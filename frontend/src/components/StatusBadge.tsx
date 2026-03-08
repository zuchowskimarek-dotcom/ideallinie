import type { ServiceStatus } from "../types";

export function StatusBadge({ status }: { status: ServiceStatus }) {
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
