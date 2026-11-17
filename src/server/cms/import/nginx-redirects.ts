export type ParsedRedirect = {
  fromPath: string;
  toPath: string;
  code: 301 | 302;
  match: "EXACT" | "PREFIX";
  note?: string;
};

/**
 * Парсит location-редиректы из nginx.conf leadweb.
 * Поддерживает `return 301 /path/;` и `rewrite ^/leadweb/(.*)$ /$1 permanent;`.
 */
export function parseNginxRedirects(conf: string): ParsedRedirect[] {
  const out: ParsedRedirect[] = [];
  const locationRe =
    /location\s+(?:=\s+)?(?<exact>"?[^"{\s]+"?|\S+)\s*\{(?<body>[^{}]*)\}/g;

  let m: RegExpExecArray | null;
  while ((m = locationRe.exec(conf))) {
    const rawLoc = (m.groups?.exact || "").replace(/"/g, "");
    const body = m.groups?.body || "";
    const isExact = /location\s+=/.test(m[0]);

    const ret = body.match(/return\s+(301|302)\s+(\S+)\s*;/);
    const rewrite = body.match(
      /rewrite\s+\^([^$]+)\$\s+(\S+)\s+(permanent|redirect)\s*;/,
    );

    if (rewrite) {
      const from = rewrite[1].replace(/\\\//g, "/").replace(/^\^/, "");
      // ^/leadweb/(.*)$ → PREFIX /leadweb/
      let fromPath = from.replace(/\(\.\*\)$/, "").replace(/\\\./g, ".");
      if (!fromPath.endsWith("/") && from.includes("(.*)")) fromPath += "/";
      const to = rewrite[2].replace(/\$1/, "");
      out.push({
        fromPath: fromPath.startsWith("/") ? fromPath : `/${fromPath}`,
        toPath: to === "/" || to === "" ? "/" : to.endsWith("/") ? to : `${to}/`,
        code: rewrite[3] === "permanent" ? 301 : 302,
        match: "PREFIX",
        note: "nginx rewrite",
      });
      continue;
    }

    if (ret) {
      const code = Number(ret[1]) as 301 | 302;
      let toPath = ret[2].replace(/;$/, "");
      if (toPath.startsWith("http")) {
        /* keep absolute */
      } else if (!toPath.startsWith("/")) {
        toPath = `/${toPath}`;
      }
      let fromPath = rawLoc;
      if (!fromPath.startsWith("/")) fromPath = `/${fromPath}`;
      out.push({
        fromPath,
        toPath,
        code,
        match: isExact || !fromPath.endsWith("/") ? "EXACT" : "EXACT",
        note: "nginx return",
      });
    }
  }

  return out;
}
