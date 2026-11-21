import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLeadsSsoConfig, leadsSsoMissingKeys } from "./config";

describe("leads config", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.LEADS_BASE_URL;
    delete process.env.HUB_LEADS_SSO_SECRET;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("без env — null и список missing", () => {
    expect(getLeadsSsoConfig()).toBeNull();
    expect(leadsSsoMissingKeys()).toEqual([
      "LEADS_BASE_URL",
      "HUB_LEADS_SSO_SECRET",
    ]);
  });

  it("оба ключа — config готов", () => {
    process.env.LEADS_BASE_URL = "https://lead.vaybik.ru/";
    process.env.HUB_LEADS_SSO_SECRET = "secret-not-real";
    expect(getLeadsSsoConfig()).toEqual({
      baseUrl: "https://lead.vaybik.ru",
      ssoSecret: "secret-not-real",
    });
    expect(leadsSsoMissingKeys()).toEqual([]);
  });
});
