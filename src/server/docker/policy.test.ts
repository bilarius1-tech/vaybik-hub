import { describe, expect, it } from "vitest";
import {
  assertContainerAllowed,
  assertNotDenied,
  DockerPolicyError,
  isDeniedImage,
  isDeniedName,
} from "./policy";

describe("docker policy", () => {
  it("denylist по имени", () => {
    expect(isDeniedName("traefik")).toBe(true);
    expect(isDeniedName("traefik-proxy")).toBe(true);
    expect(isDeniedName("amnezia-vpn")).toBe(true);
    expect(isDeniedName("xray-core")).toBe(true);
    expect(isDeniedName("wg-easy")).toBe(true);
    expect(isDeniedName("region")).toBe(false);
    expect(isDeniedName("vaybik-hub-prod-app-1")).toBe(false);
  });

  it("denylist по образу", () => {
    expect(isDeniedImage("traefik:v3.6")).toBe(true);
    expect(isDeniedImage("amneziawg-go:latest")).toBe(true);
    expect(isDeniedImage("nginx:alpine")).toBe(false);
  });

  it("запрещает denylist даже если в реестре", () => {
    expect(() =>
      assertContainerAllowed(
        { name: "traefik", image: "traefik:latest", labels: {} },
        ["traefik"],
      ),
    ).toThrow(DockerPolicyError);
  });

  it("запрещает контейнер вне реестра", () => {
    expect(() =>
      assertContainerAllowed(
        {
          name: "random-box",
          image: "nginx",
          labels: { "vaybik.managed": "true" },
        },
        ["region"],
      ),
    ).toThrow(DockerPolicyError);
  });

  it("разрешает контейнер из реестра", () => {
    expect(() =>
      assertContainerAllowed(
        {
          name: "region",
          image: "nginx:alpine",
          labels: { "vaybik.managed": "true" },
        },
        ["region"],
      ),
    ).not.toThrow();
  });

  it("assertNotDenied пропускает whoami и обычные", () => {
    expect(() =>
      assertNotDenied({ name: "whoami", image: "traefik/whoami" }),
    ).not.toThrow();
    expect(isDeniedImage("traefik/whoami:latest")).toBe(false);
    expect(isDeniedImage("traefik:v3")).toBe(true);
  });
});
