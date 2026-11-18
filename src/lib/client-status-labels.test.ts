import { describe, expect, it } from "vitest";
import {
  CLIENT_STATUS_LABEL,
  EXPIRED_LABEL,
  SERVICE_STATUS_LABEL,
  clientStatusLabel,
  serviceStatusLabel,
} from "./client-status-labels";

describe("client-status-labels", () => {
  it("клиент по-русски", () => {
    expect(CLIENT_STATUS_LABEL.active).toBe("Активен");
    expect(CLIENT_STATUS_LABEL.paused).toBe("На паузе");
    expect(CLIENT_STATUS_LABEL.archived).toBe("Архив");
    expect(clientStatusLabel("active")).toBe("Активен");
  });

  it("подключение по-русски", () => {
    expect(SERVICE_STATUS_LABEL.setup).toBe("Настройка");
    expect(SERVICE_STATUS_LABEL.active).toBe("Активен");
    expect(SERVICE_STATUS_LABEL.paused).toBe("На паузе");
    expect(SERVICE_STATUS_LABEL.off).toBe("Отключён");
    expect(serviceStatusLabel("EXPIRED")).toBe(EXPIRED_LABEL);
  });
});
