import { getDocker } from "@/server/docker/client";
import { isDeniedImage, isDeniedName } from "@/server/docker/policy";

export type DashboardContainerRow = {
  name: string;
  state: "up" | "down";
  status: string;
};

/** Имена, которые показываем на дашборде (только статус, без управления). */
export function isDashboardContainerName(name: string): boolean {
  const n = name.replace(/^\//, "").toLowerCase();
  if (isDeniedName(n)) return false;
  if (n.startsWith("vaybik")) return true;
  if (n.includes("design-atlas") || n.includes("design_atlas")) return true;
  if (n === "region" || n.startsWith("region-") || n.startsWith("region_")) {
    return true;
  }
  return false;
}

/**
 * Список прикладных контейнеров через socket-proxy.
 * Denylist (Traefik/VPN) не включаем. Region — только статус.
 * Ошибки Docker → пустой список (дашборд не падает).
 */
export async function listDashboardContainers(): Promise<DashboardContainerRow[]> {
  try {
    const docker = getDocker();
    const list = await docker.listContainers({ all: true });
    const rows: DashboardContainerRow[] = [];
    for (const c of list) {
      const rawName =
        (c.Names?.[0] || "").replace(/^\//, "") ||
        c.Id?.slice(0, 12) ||
        "unknown";
      if (!isDashboardContainerName(rawName)) continue;
      if (isDeniedImage(c.Image)) continue;
      const running = (c.State || "").toLowerCase() === "running";
      rows.push({
        name: rawName,
        state: running ? "up" : "down",
        status: c.Status || c.State || "—",
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return rows;
  } catch {
    return [];
  }
}
