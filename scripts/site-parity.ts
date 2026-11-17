#!/usr/bin/env tsx
/**
 * Сравнение статики vaybik.ru и CMS site-test.
 *   npx tsx scripts/site-parity.ts
 *   SITE_A=https://vaybik.ru SITE_B=https://site-test.vaybik.ru npx tsx scripts/site-parity.ts
 *
 * FAIL — только видимые расхождения (вёрстка/контент/стили на экране).
 * WARN — невидимые (aria/id/reveal/b↔strong/alt/scope) + пояснение.
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
  "scope",
  "alt",
] as const;

/** Атрибуты/теги, которые не видны глазу (a11y, якоря без ссылок, анимация reveal). */
const INVISIBLE_ATTRS = new Set([
  "id",
  "alt",
  "scope",
  "decoding",
  "fetchpriority",
  "loading",
]);

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
      .split(/[^a-zа-яё0-9]+/i)
      .filter(Boolean),
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

function normalizeAttrValue(key: string, value: string): string {
  if (
    (key.startsWith("data-") ||
      key === "data-magic-rings" ||
      key === "data-gradient-blinds") &&
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

/** Сигнатура только видимого: без aria/id/alt/scope/reveal, b≡strong, data-* JSON sorted. */
function visibleSignature(full: string): string {
  const parts = full.split("|");
  let tag = parts[0] || "";
  if (tag === "strong") tag = "b";
  const out: string[] = [tag];
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const key = p.slice(0, eq);
    let val = p.slice(eq + 1);
    if (key.startsWith("aria-") || INVISIBLE_ATTRS.has(key)) continue;
    if (key === "class") {
      val = val
        .split(/\s+/)
        .filter((c) => c && c !== "reveal")
        .join(" ");
      if (!val) continue;
    }
    if (key.startsWith("data-") && /^\s*[\[{]/.test(val)) {
      val = normalizeAttrValue(key, val);
    }
    out.push(`${key}=${val}`);
  }
  return out.join("|");
}

function walkSignatures(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<Element>,
): string[] {
  const out: string[] = [];
  root.find("*").addBack().each((_, el) => {
    if (el.type !== "tag") return;
    if (
      el.tagName === "script" ||
      el.tagName === "style" ||
      el.tagName === "noscript"
    ) {
      return;
    }
    out.push(nodeSignature(el));
  });
  return out;
}

function explainInvisible(a: string, b: string): string | null {
  const reasons = new Set<string>();
  const pa = a.split("|");
  const pb = b.split("|");
  const ta = pa[0] === "strong" ? "b" : pa[0];
  const tb = pb[0] === "strong" ? "b" : pb[0];
  if (ta !== tb) return null;
  if (
    (pa[0] === "strong" || pa[0] === "b") &&
    (pb[0] === "strong" || pb[0] === "b") &&
    pa[0] !== pb[0]
  ) {
    reasons.add("b↔strong");
  }
  const map = (parts: string[]) => {
    const m = new Map<string, string>();
    for (const p of parts.slice(1)) {
      const eq = p.indexOf("=");
      if (eq > 0) m.set(p.slice(0, eq), p.slice(eq + 1));
    }
    return m;
  };
  const ma = map(pa);
  const mb = map(pb);
  const keys = new Set([...ma.keys(), ...mb.keys()]);
  for (const k of keys) {
    const va = ma.get(k);
    const vb = mb.get(k);
    if (va === vb) continue;
    if (k.startsWith("aria-")) reasons.add("aria-*");
    else if (k === "id") reasons.add("id (якорь/a11y)");
    else if (k === "alt") reasons.add("alt");
    else if (k === "scope") reasons.add("scope");
    else if (k === "class") {
      const ca = new Set((va || "").split(/\s+/).filter(Boolean));
      const cb = new Set((vb || "").split(/\s+/).filter(Boolean));
      const onlyA = [...ca].filter((c) => !cb.has(c));
      const onlyB = [...cb].filter((c) => !ca.has(c));
      if (
        [...onlyA, ...onlyB].every((c) => c === "reveal") &&
        onlyA.length + onlyB.length > 0
      ) {
        reasons.add("class=reveal");
      } else return null;
    } else if (k.startsWith("data-")) {
      try {
        if (
          JSON.stringify(stableJsonValue(JSON.parse(va || "null"))) ===
          JSON.stringify(stableJsonValue(JSON.parse(vb || "null")))
        ) {
          reasons.add("data-* порядок ключей");
          continue;
        }
      } catch {
        /* visible */
      }
      return null;
    } else return null;
  }
  if (!reasons.size && visibleSignature(a) === visibleSignature(b)) {
    reasons.add("невидимые атрибуты");
  }
  return reasons.size ? [...reasons].join(", ") : null;
}

type DomDiffResult = {
  visibleFail: boolean;
  invisibleWarn: boolean;
  notes: string[];
};

function diffSignaturesVisible(
  label: string,
  a: string[],
  b: string[],
): DomDiffResult {
  const notes: string[] = [];
  const va = a.map(visibleSignature);
  const vb = b.map(visibleSignature);
  const max = Math.max(va.length, vb.length);
  const visDiffs: string[] = [];
  const invisReasons = new Set<string>();
  let invisCount = 0;

  // Сначала полное сравнение с классификацией сдвига
  // Если длины равны — поэлементно; иначе ищем видимый сдвиг
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] === b[i]) continue;
    if (va[i] === vb[i]) {
      const why = explainInvisible(a[i]!, b[i]!);
      invisCount += 1;
      if (why) why.split(", ").forEach((r) => invisReasons.add(r));
      else invisReasons.add("невидимые атрибуты");
      continue;
    }
    visDiffs.push(
      `#${i}: «${(a[i] || "∅").slice(0, 70)}» ≠ «${(b[i] || "∅").slice(0, 70)}»`,
    );
    if (visDiffs.length >= 5) break;
  }
  if (a.length !== b.length && visDiffs.length < 5) {
    // видимый сдвиг по длине — если после нормализации длины тоже разные
    if (va.length !== vb.length || visDiffs.length === 0) {
      // найти первый видимый mismatch по нормализованным
      for (let i = 0; i < max; i += 1) {
        if (va[i] !== vb[i]) {
          const already = visDiffs.some((d) => d.startsWith(`#${i}:`));
          if (!already) {
            visDiffs.push(
              `#${i}: «${(a[i] || "∅").slice(0, 70)}» ≠ «${(b[i] || "∅").slice(0, 70)}»`,
            );
          }
          if (visDiffs.length >= 5) break;
        }
      }
      if (va.length !== vb.length) {
        notes.push(
          `DOM ${label}: видимых узлов ${va.length} vs ${vb.length}`,
        );
      }
    }
  }

  if (invisCount && !visDiffs.length && va.length === vb.length) {
    notes.push(
      `DOM ${label}: только невидимое (${invisCount} узлов: ${[...invisReasons].join(", ") || "aria/id/reveal"})`,
    );
    return { visibleFail: false, invisibleWarn: true, notes };
  }
  if (invisCount && visDiffs.length) {
    notes.push(
      `DOM ${label}: также невидимое ×${invisCount} (${[...invisReasons].join(", ")})`,
    );
  }
  if (visDiffs.length) {
    notes.push(
      `DOM ${label}: ${a.length} vs ${b.length} узлов; ${visDiffs.join("; ")}`,
    );
    return { visibleFail: true, invisibleWarn: invisCount > 0, notes };
  }
  if (invisCount) {
    notes.push(
      `DOM ${label}: только невидимое (${invisCount} узлов: ${[...invisReasons].join(", ")})`,
    );
    return { visibleFail: false, invisibleWarn: true, notes };
  }
  return { visibleFail: false, invisibleWarn: false, notes: [] };
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
  notes.push(`${kind}: [${a.join(", ")}] ≠ [${b.join(", ")}]`);
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
      // title/description/h1 текст — видимо
      if (name === "h1") fail();
      else warn();
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

  const svgA = countSvgWithoutViewBox($a);
  const svgB = countSvgWithoutViewBox($b);
  if (svgB > svgA) {
    notes.push(`svg без viewBox: static ${svgA} < cms ${svgB}`);
    fail();
  }

  for (const sel of ["header.hdr", "main#main", "footer.ftr"] as const) {
    const sa = walkSignatures($a, $a(sel).first() as cheerio.Cheerio<Element>);
    const sb = walkSignatures($b, $b(sel).first() as cheerio.Cheerio<Element>);
    const d = diffSignaturesVisible(sel, sa, sb);
    notes.push(...d.notes);
    if (d.visibleFail) fail();
    else if (d.invisibleWarn) warn();
  }

  if ($a("#calc-sec").length || $b("#calc-sec").length) {
    const sa = walkSignatures(
      $a,
      $a("#calc-sec").first() as cheerio.Cheerio<Element>,
    );
    const sb = walkSignatures(
      $b,
      $b("#calc-sec").first() as cheerio.Cheerio<Element>,
    );
    const d = diffSignaturesVisible("#calc-sec", sa, sb);
    notes.push(...d.notes);
    if (d.visibleFail) fail();
    else if (d.invisibleWarn) warn();
  }

  if (path.includes("kalkulyator")) {
    const sa = walkSignatures($a, $a("main").first() as cheerio.Cheerio<Element>);
    const sb = walkSignatures($b, $b("main").first() as cheerio.Cheerio<Element>);
    const d = diffSignaturesVisible("main@kalkulyator", sa, sb);
    notes.push(...d.notes);
    if (d.visibleFail) fail();
    else if (d.invisibleWarn) warn();
    const ba = walkSignatures(
      $a,
      $a(".lc-bar").first() as cheerio.Cheerio<Element>,
    );
    const bb = walkSignatures(
      $b,
      $b(".lc-bar").first() as cheerio.Cheerio<Element>,
    );
    const db = diffSignaturesVisible(".lc-bar", ba, bb);
    notes.push(...db.notes);
    if (db.visibleFail) fail();
    else if (db.invisibleWarn) warn();
  }

  return { url: path, status, notes };
}

async function main() {
  const sm = await fetchText(`${A}/sitemap.xml`);
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    try {
      return new URL(m[1]!).pathname;
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
  writeFileSync(`/tmp/site-parity-${date}.md`, md);
  writeFileSync(`/tmp/site-parity-${date}.json`, JSON.stringify(rows, null, 2));
  console.log(md);
  console.log(`wrote /tmp/site-parity-${date}.md /tmp/site-parity-${date}.json`);
  if (rows.some((r) => r.status === "FAIL")) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
