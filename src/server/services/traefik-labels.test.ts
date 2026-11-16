import { describe, expect, it } from "vitest";
import { generateTraefikComposeSnippet } from "./traefik-labels";

describe("traefik labels", () => {
  it("генерирует YAML с Host и certresolver", () => {
    const yaml = generateTraefikComposeSnippet({
      slug: "chat",
      subdomain: "chat.vaybik.ru",
      port: 3000,
      network: "proxy",
      certresolver: "le",
    });
    expect(yaml).toContain("Host(`chat.vaybik.ru`)");
    expect(yaml).toContain("tls.certresolver=le");
    expect(yaml).toContain("loadbalancer.server.port=3000");
    expect(yaml).toContain("to-https@docker");
    expect(yaml).toContain("vaybik.managed=true");
  });
});
