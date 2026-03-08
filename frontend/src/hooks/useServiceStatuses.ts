import { useEffect, useState } from "react";
import type { ServiceStatus } from "../types";
import { SERVICES } from "../config";

export function useServiceStatuses() {
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
