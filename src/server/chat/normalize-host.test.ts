import { describe, expect, it } from "vitest";
import {
  hostFromSiteUrl,
  normalizeSiteHost,
  siteUrlFromHost,
} from "./normalize-host";

describe("normalizeSiteHost", () => {
  it("нормализует хост и URL", () => {
    expect(normalizeSiteHost("Example.RU")).toBe("example.ru");
    expect(normalizeSiteHost("https://www.example.ru/path")).toBe("example.ru");
    expect(normalizeSiteHost("http://example.ru:443")).toBe("example.ru");
  });

  it("пустой / невалидный → null", () => {
    expect(normalizeSiteHost(null)).toBeNull();
    expect(normalizeSiteHost("")).toBeNull();
    expect(normalizeSiteHost("   ")).toBeNull();
    expect(normalizeSiteHost("localhost")).toBeNull();
    expect(normalizeSiteHost("no spaces.ru")).toBeNull();
  });

  it("siteUrlFromHost / hostFromSiteUrl", () => {
    expect(siteUrlFromHost("a.ru")).toBe("https://a.ru");
    expect(hostFromSiteUrl("https://www.a.ru/")).toBe("a.ru");
  });
});
