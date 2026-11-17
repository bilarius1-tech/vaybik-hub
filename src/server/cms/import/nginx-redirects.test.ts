import { describe, expect, it } from "vitest";
import { parseNginxRedirects } from "./nginx-redirects";

const SAMPLE = `
server {
    location = /automation.html {
        return 301 /avtomatizaciya-1c/;
    }
    location = /bitrix.html {
        return 301 /bitrix/;
    }
    location = /kontakty {
        return 301 /o-nas/;
    }
    location = /kontakty/ {
        return 301 /o-nas/;
    }
    location /leadweb/ {
        rewrite ^/leadweb/(.*)$ /$1 permanent;
    }
    location = /leadweb {
        return 301 /;
    }
}
`;

describe("parseNginxRedirects", () => {
  it("парсит return и rewrite PREFIX", () => {
    const list = parseNginxRedirects(SAMPLE);
    expect(list.some((r) => r.fromPath === "/automation.html" && r.toPath === "/avtomatizaciya-1c/")).toBe(true);
    expect(list.some((r) => r.fromPath === "/leadweb/" && r.match === "PREFIX")).toBe(true);
    expect(list.some((r) => r.fromPath === "/leadweb" && r.toPath === "/")).toBe(true);
    expect(list.filter((r) => r.code === 301).length).toBeGreaterThanOrEqual(5);
  });
});
