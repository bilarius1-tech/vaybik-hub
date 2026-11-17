#!/usr/bin/env tsx
/**
 * Сравнение статики vaybik.ru и CMS site-test.
 *   npx tsx scripts/site-parity.ts
 *   SITE_A=https://vaybik.ru SITE_B=https://site-test.vaybik.ru npx tsx scripts/site-parity.ts
 */
import { writeFileSync } from "node:fs";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";

const A = (process.env.SITE_A || "https://vaybik.ru").replace(/\/$/, "");
const B = (process.env.SITE_B || "https://site-test.vaybik.ru").replace(
  /\/$/,
  "",
);
const date = new Date().toISOString().slice(0, 10);

type Row = {
  url: string;
  status: "OK" | "WARN" | "FAIL";
  notes: string[];
};

const STRUCT_ATTRS = [
  "id",
  "class",
  "name",
  "type",
  "value",
  "checked",
  "for",
  "viewBox",
  "viewbox",
  "style",
] as const;

async function fetchText(url: string) {
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "vaybik-site-parity" },
  });
  const text = res.status < 400 || res.status === 404 ? await res.text() : "";
  return {
    status: res.status,
    headers: res.headers,
    text,
    location: res.headers.get("location"),
  };
}

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function similarity(a: string, b: string): number {
  const Aset = words(a);
  const Bset = words(b);
  if (!Aset.size && !Bset.size) return 1;
  let inter = 0;
  for (const w of Aset) if (Bset.has(w)) inter += 1;
  return inter / Math.max(Aset.size, Bset.size);
}

function assetPath(href: string): string {
  try {
    const u = new URL(href, "https://example.test");
    return `${u.pathname}${u.search}`;
  } catch {
    return href;
  }
}

function listAssets(
  $: cheerio.CheerioAPI,
  kind: "css" | "js",
): string[] {
  if (kind === "css") {
    return $("link[rel='stylesheet']")
      .map((_, el) => assetPath($(el).attr("href") || ""))
      .get()
      .filter(Boolean);
  }
  return $("script[src]")
    .map((_, el) => assetPath($(el).attr("src") || ""))
    .get()
    .filter(Boolean);
}

function stableJsonValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stableJsonValue);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = stableJsonValue((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

/** data-* JSON сравниваем по смыслу (порядок ключей в leadweb/CMS может отличаться). */
function normalizeAttrValue(key: string, value: string): string {
  if (
    (key.startsWith("data-") || key === "data-magic-rings" || key === "data-gradient-blinds") &&
    /^\s*[\[{]/.test(value)
  ) {
    try {
      return JSON.stringify(stableJsonValue(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  return value;
}

function nodeSignature(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const attrs = el.attribs || {};
  const parts: string[] = [tag];
  for (const key of STRUCT_ATTRS) {
    if (attrs[key] != null && attrs[key] !== "") {
      parts.push(`${key}=${normalizeAttrValue(key, attrs[key])}`);
    }
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("data-") || k.startsWith("aria-")) {
      parts.push(`${k}=${normalizeAttrValue(k, v)}`);
    }
  }
  return parts.join("|");
}

function walkSignatures(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<Element>,
): string[] {
  const out: string[] = [];
  root.find("*").addBack().each((_, el) => {
    if (el.type !== "tag") return;
    // скрипты/стили внутри секции не структурный контент
    if (el.tagName === "script" || el.tagName === "style" || el.tagName === "noscript") {
      return;
    }
    out.push(nodeSignature(el));
  });
  return out;
}

function diffSignatures(
  label: string,
  a: string[],
  b: string[],
  notes: string[],
): boolean {
  const max = Math.max(a.length, b.length);
  const diffs: string[] = [];
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) {
      diffs.push(`#${i}: «${(a[i] || "∅").slice(0, 80)}» ≠ «${(b[i] || "∅").slice(0, 80)}»`);
      if (diffs.length >= 5) break;
    }
  }
  if (diffs.length) {
    notes.push(
      `DOM ${label}: ${a.length} vs ${b.length} узлов; ${diffs.join("; ")}`,
    );
    return true;
  }
  return false;
}

function countSvgWithoutViewBox($: cheerio.CheerioAPI): number {
  let n = 0;
  $("svg").each((_, el) => {
    const attrs = el.attribs || {};
    if (!attrs.viewBox && !attrs.viewbox) n += 1;
  });
  return n;
}

function compareAssetLists(
  kind: "css" | "js",
  a: string[],
  b: string[],
  notes: string[],
): boolean {
  if (a.length === b.length && a.every((v, i) => v === b[i])) return false;
  notes.push(
    `${kind}: [${a.join(", ")}] ≠ [${b.join(", ")}]`,
  );
  return true;
}

async function comparePage(path: string): Promise<Row> {
  const notes: string[] = [];
  let status: Row["status"] = "OK";
  const fail = () => {
    status = "FAIL";
  };
  const warn = () => {
    if (status === "OK") status = "WARN";
  };

  const ua = await fetchText(`${A}${path}`);
  let ub = await fetchText(`${B}${path}`);
  let followedIndexHtml = false;
  if (ua.status !== ub.status) {
    const canonPath = path.replace(/\/index\.html$/, "/");
    const indexHtmlCanon =
      path.endsWith("/index.html") &&
      (ub.status === 301 || ub.status === 302) &&
      (ub.location || "").replace(/\/$/, "") === canonPath.replace(/\/$/, "");
    notes.push(
      `status ${ua.status} vs ${ub.status}${ub.location ? ` → ${ub.location}` : ""}`,
    );
    if (indexHtmlCanon) {
      warn();
      followedIndexHtml = true;
      ub = await fetchText(`${B}${canonPath}`);
    } else {
      fail();
    }
  }
  if (ua.status >= 400 || ub.status >= 400) {
    return {
      url: path,
      status,
      notes: notes.length ? notes : [`http ${ua.status}/${ub.status}`],
    };
  }
  if (
    (ua.status === 301 || ua.status === 302) &&
    (ub.status === 301 || ub.status === 302)
  ) {
    notes.push("оба 3xx — контент пропущен");
    warn();
    return { url: path, status, notes };
  }
  const $a = cheerio.load(ua.text);
  const $b = cheerio.load(ub.text);
  $a("main script, main style, main noscript").remove();
  $b("main script, main style, main noscript").remove();

  const checks: Array<[string, string, string]> = [
    ["title", $a("title").text().trim(), $b("title").text().trim()],
    [
      "description",
      $a('meta[name="description"]').attr("content") || "",
      $b('meta[name="description"]').attr("content") || "",
    ],
    ["h1", $a("h1").first().text().trim(), $b("h1").first().text().trim()],
  ];
  for (const [name, va, vb] of checks) {
    if (va !== vb) {
      notes.push(`${name}: «${va.slice(0, 60)}» ≠ «${vb.slice(0, 60)}»`);
      warn();
    }
  }

  const sim = similarity($a("main").html() || "", $b("main").html() || "");
  if (sim < 0.97) {
    notes.push(`main text similarity ${sim.toFixed(3)} < 0.97`);
    if (followedIndexHtml) warn();
    else fail();
  } else if (sim < 0.995) {
    notes.push(`main text similarity ${sim.toFixed(3)}`);
    warn();
  }

  const marker = ub.headers.get("x-vaybik-site");
  if (marker !== "cms") {
    notes.push(`X-Vaybik-Site=${marker || "missing"}`);
    fail();
  }

  // CSS/JS списки (путь + ?v=)
  if (
    compareAssetLists("css", listAssets($a, "css"), listAssets($b, "css"), notes)
  ) {
    fail();
  }
  if (
    compareAssetLists("js", listAssets($a, "js"), listAssets($b, "js"), notes)
  ) {
    fail();
  }

  // svg без viewBox: CMS не должно быть больше статики
  const svgA = countSvgWithoutViewBox($a);
  const svgB = countSvgWithoutViewBox($b);
  if (svgB > svgA) {
    notes.push(`svg без viewBox: static ${svgA} < cms ${svgB}`);
    fail();
  }

  // DOM header / main / footer
  for (const sel of ["header.hdr", "main#main", "footer.ftr"] as const) {
    const sa = walkSignatures($a, $a(sel).first() as cheerio.Cheerio<Element>);
    const sb = walkSignatures($b, $b(sel).first() as cheerio.Cheerio<Element>);
    if (diffSignatures(sel, sa, sb, notes)) fail();
  }

  // Мини-калькулятор
  if ($a("#calc-sec").length || $b("#calc-sec").length) {
    const sa = walkSignatures(
      $a,
      $a("#calc-sec").first() as cheerio.Cheerio<Element>,
    );
    const sb = walkSignatures(
      $b,
      $b("#calc-sec").first() as cheerio.Cheerio<Element>,
    );
    if (diffSignatures("#calc-sec", sa, sb, notes)) fail();
  }

  // Полный калькулятор
  if (path.includes("kalkulyator")) {
    const sa = walkSignatures($a, $a("main").first() as cheerio.Cheerio<Element>);
    const sb = walkSignatures($b, $b("main").first() as cheerio.Cheerio<Element>);
    if (diffSignatures("main@kalkulyator", sa, sb, notes)) fail();
    const ba = walkSignatures(
      $a,
      $a(".lc-bar").first() as cheerio.Cheerio<Element>,
    );
    const bb = walkSignatures(
      $b,
      $b(".lc-bar").first() as cheerio.Cheerio<Element>,
    );
    if (diffSignatures(".lc-bar", ba, bb, notes)) fail();
  }

  return { url: path, status, notes };
}

async function main() {
  const sm = await fetchText(`${A}/sitemap.xml`);
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    try {
      return new URL(m[1]).pathname;
    } catch {
      return "/";
    }
  });
  const paths = Array.from(
    new Set(["/", ...locs, "/uslugi", "/uslugi/index.html"]),
  );
  const rows: Row[] = [];
  for (const p of paths) {
    rows.push(await comparePage(p));
  }
  for (const p of ["/uslugi", "/uslugi/index.html"]) {
    const r = await fetchText(`${B}${p}`);
    rows.push({
      url: `${p} (B redirect)`,
      status: r.status === 301 || r.status === 302 ? "OK" : "WARN",
      notes: [`${r.status} → ${r.location || ""}`],
    });
  }
  const md = [
    `# Site parity ${date}`,
    "",
    `A=${A}  B=${B}`,
    "",
    "| URL | Status | Notes |",
    "|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.url} | ${r.status} | ${r.notes.join("; ").replace(/\|/g, "/")} |`,
    ),
    "",
  ].join("\n");
  const outMd = `/tmp/site-parity-${date}.md`;
  const outJson = `/tmp/site-parity-${date}.json`;
  writeFileSync(outMd, md);
  writeFileSync(outJson, JSON.stringify(rows, null, 2));
  console.log(md);
  console.log("wrote", outMd, outJson);
  if (rows.some((r) => r.status === "FAIL")) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
