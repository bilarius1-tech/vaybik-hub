import { describe, expect, it } from "vitest";
import { isPrivateIp, parsePublicHttpUrl } from "./ssrf";

describe("ssrf", () => {
  it("блокирует приватные IPv4", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.5")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("разрешает только http(s) публичные URL", () => {
    expect(parsePublicHttpUrl("https://vaybik.ru/").ok).toBe(true);
    expect(parsePublicHttpUrl("ftp://vaybik.ru/").ok).toBe(false);
    expect(parsePublicHttpUrl("http://127.0.0.1/").ok).toBe(false);
    expect(parsePublicHttpUrl("http://localhost/").ok).toBe(false);
    expect(parsePublicHttpUrl("https://user:pass@evil.com/").ok).toBe(false);
  });
});
