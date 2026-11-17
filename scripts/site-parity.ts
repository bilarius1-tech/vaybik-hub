#!/usr/bin/env tsx
/**
 * Сравнение статики vaybik.ru и CMS site-test.
 *   npx tsx scripts/site-parity.ts
 *   SITE_A=https://vaybik.ru SITE_B=https://site-test.vaybik.ru npx tsx scripts/site-parity.ts
 */
import { writeFileSync } from "node:fs";
import * as cheerio from "cheerio";

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

async function fetchText(url: string) {
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "vaybik-site-parity" },
  });
  const text = res.status < 400 || res.status === 404 ? await res.text() : "";
  return { status: res.status, headers: res.headers, text, location: res.headers.get("location") };
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

async function comparePage(path: string): Promise<Row> {
  const notes: string[] = [];
  let status: Row["status"] = "OK";
  const ua = await fetchText(`${A}${path}`);
  let ub = await fetchText(`${B}${path}`);
  if (ua.status !== ub.status) {
    // nginx отдаёт /path/index.html как 200, CMS — 301 на канонический /path/
    const canonPath = path.replace(/\/index\.html$/, "/");
    const indexHtmlCanon =
      path.endsWith("/index.html") &&
      (ub.status === 301 || ub.status === 302) &&
      (ub.location || "").replace(/\/$/, "") === canonPath.replace(/\/$/, "");
    notes.push(
      `status ${ua.status} vs ${ub.status}${ub.location ? ` → ${ub.location}` : ""}`,
    );
    if (indexHtmlCanon) {
      status = "WARN";
      ub = await fetchText(`${B}${canonPath}`);
    } else {
      status = "FAIL";
    }
  }
  if (ua.status >= 400 || ub.status >= 400) {
    return {
      url: path,
      status,
      notes: notes.length ? notes : [`http ${ua.status}/${ub.status}`],
    };
  }
  // оба редиректят (например /uslugi → /uslugi/) — контент не сравниваем
  if (
    (ua.status === 301 || ua.status === 302) &&
    (ub.status === 301 || ub.status === 302)
  ) {
    notes.push("оба 3xx — контент пропущен");
    if (status === "OK") status = "WARN";
    return { url: path, status, notes };
  }
  const followedIndexHtml = path.endsWith("/index.html") && status === "WARN";
  const $a = cheerio.load(ua.text);
  const $b = cheerio.load(ub.text);
  // скрипты/стили в main (studio bootstrap) не контент страницы
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
      status = status === "FAIL" ? "FAIL" : "WARN";
    }
  }
  // html→spaces, не .text(): иначе соседние теги склеивают слова («целиПодробнее»)
  const sim = similarity($a("main").html() || "", $b("main").html() || "");
  if (sim < 0.97) {
    notes.push(`main text similarity ${sim.toFixed(3)} < 0.97`);
    // /path/index.html → канон уже сравнивается отдельно как /path/
    status = followedIndexHtml ? "WARN" : "FAIL";
  } else if (sim < 0.995) {
    notes.push(`main text similarity ${sim.toFixed(3)}`);
    if (status === "OK") status = "WARN";
  }
  const marker = ub.headers.get("x-vaybik-site");
  if (marker !== "cms") {
    notes.push(`X-Vaybik-Site=${marker || "missing"}`);
    status = "FAIL";
  }  return { url: path, status, notes };
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
  const paths = Array.from(new Set(["/", ...locs, "/uslugi", "/uslugi/index.html"]));
  const rows: Row[] = [];
  for (const p of paths) {
    rows.push(await comparePage(p));
  }
  // redirects sample
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
