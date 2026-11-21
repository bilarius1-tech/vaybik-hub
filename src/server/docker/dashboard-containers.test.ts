import { describe, expect, it } from "vitest";
import { isDashboardContainerName } from "@/server/docker/dashboard-containers";

describe("isDashboardContainerName", () => {
  it("показывает vaybik / atlas / region", () => {
    expect(isDashboardContainerName("vaybik-hub-prod-app-1")).toBe(true);
    expect(isDashboardContainerName("vaybik-chat-postgres-1")).toBe(true);
    expect(isDashboardContainerName("design-atlas")).toBe(true);
    expect(isDashboardContainerName("region")).toBe(true);
  });

  it("прячет traefik / vpn", () => {
    expect(isDashboardContainerName("traefik")).toBe(false);
    expect(isDashboardContainerName("amnezia-wg")).toBe(false);
    expect(isDashboardContainerName("xray")).toBe(false);
  });
});
