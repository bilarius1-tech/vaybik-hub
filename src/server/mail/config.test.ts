import { afterEach, describe, expect, it } from "vitest";
import { periodKindForDaysLeft } from "@/server/mail/client-notify";
import {
  cabinetLoginUrl,
  getMailConfig,
  isMailConfigured,
} from "@/server/mail/config";

describe("mail config", () => {
  const keys = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "MAIL_FROM",
    "SMTP_PORT",
    "SMTP_SECURE",
    "APP_URL",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
      delete prev[k];
    }
  });

  function setEnv(map: Partial<Record<(typeof keys)[number], string>>) {
    for (const k of keys) {
      if (!(k in prev)) prev[k] = process.env[k];
    }
    for (const [k, v] of Object.entries(map)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  it("без SMTP — не настроено", () => {
    setEnv({
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      MAIL_FROM: "",
    });
    expect(isMailConfigured()).toBe(false);
    expect(getMailConfig()).toBeNull();
  });

  it("с SMTP — конфиг есть", () => {
    setEnv({
      SMTP_HOST: "smtp.yandex.net",
      SMTP_USER: "bilariuss@yandex.ru",
      SMTP_PASS: "secret",
      MAIL_FROM: "Вайбик <bilariuss@yandex.ru>",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
    });
    expect(isMailConfigured()).toBe(true);
    const c = getMailConfig();
    expect(c?.host).toBe("smtp.yandex.net");
    expect(c?.user).toBe("bilariuss@yandex.ru");
  });

  it("cabinetLoginUrl из APP_URL", () => {
    setEnv({ APP_URL: "https://vaybik.ru/admin" });
    expect(cabinetLoginUrl()).toBe("https://vaybik.ru/admin/login");
  });
});

describe("periodKindForDaysLeft", () => {
  it("7 / 1 / -1 (expired), иначе null", () => {
    expect(periodKindForDaysLeft(7)).toBe("expiry_7");
    expect(periodKindForDaysLeft(1)).toBe("expiry_1");
    expect(periodKindForDaysLeft(-1)).toBe("expired");
    expect(periodKindForDaysLeft(0)).toBeNull();
    expect(periodKindForDaysLeft(2)).toBeNull();
    expect(periodKindForDaysLeft(-2)).toBeNull();
  });
});
