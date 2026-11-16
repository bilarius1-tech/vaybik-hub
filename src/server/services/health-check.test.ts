import { describe, expect, it } from "vitest";
import { runHealthCheck } from "./health-check";

describe("runHealthCheck", () => {
  it("отклоняет SSRF URL без сетевого запроса", async () => {
    const result = await runHealthCheck({
      healthUrl: "http://127.0.0.1/secret",
    });
    expect(result.status).toBe("DOWN");
    expect(result.httpStatus).toBeNull();
    expect(result.error).toMatch(/приват|запрещ/i);
  });

  it("отклоняет не-http схемы", async () => {
    const result = await runHealthCheck({
      healthUrl: "file:///etc/passwd",
    });
    expect(result.status).toBe("DOWN");
    expect(result.error).toMatch(/http/i);
  });
});
