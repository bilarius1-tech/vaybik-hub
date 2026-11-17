/**
 * Миграция plain/markdown → *Html поля в блоках.
 * Usage: npx tsx scripts/cms-richtext-migrate.ts [--dry-run] [--only=/path/] [--src=/path/to/site]
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { prisma } from "../src/server/db";
import { parseBlockData } from "../src/server/cms/blocks";
import { sanitizeRichText } from "../src/server/cms/sanitize";
import { simpleMarkdown, esc } from "../src/server/cms/render/escape";
import type { Prisma } from "@prisma/client";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("-")) {
    return process.argv[i + 1];
  }
  const pref = process.argv.find((a) => a.startsWith(`${name}=`));
  return pref ? pref.slice(name.length + 1) : undefined;
}

function plainToHtml(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (/[*_\[`]/.test(t) || t.includes("\n")) {
    return sanitizeRichText(simpleMarkdown(t), "basic");
  }
  return sanitizeRichText(`<p>${esc(t)}</p>`, "basic");
}

function inlineToHtml(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return sanitizeRichText(simpleMarkdown(t).replace(/^<p>|<\/p>$/g, ""), "inline");
}

async function loadAnswerSources(
  srcRoot: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name === "index.html" || e.name.endsWith(".html")) {
        const html = await readFile(p, "utf8");
        const $ = cheerio.load(html);
        const answer = $(".answer").first();
        if (answer.length) {
          const rel = "/" + path.relative(srcRoot, path.dirname(p)).replace(/\\/g, "/");
          const pagePath = rel === "/." ? "/" : rel.endsWith("/") ? rel : `${rel}/`;
          map.set(pagePath.replace(/\/+/g, "/"), answer.html() || "");
        }
      }
    }
  }
  const st = await stat(srcRoot).catch(() => null);
  if (st?.isDirectory()) await walk(srcRoot);
  return map;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const only = arg("--only");
  const src = arg("--src");

  const pages = await prisma.page.findMany({
    where: only ? { path: only } : undefined,
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });

  const answerSrc = src ? await loadAnswerSources(src) : new Map<string, string>();

  let changedBlocks = 0;
  let changedFields = 0;
  const report: string[] = [];

  for (const page of pages) {
    let pageDirty = false;
    const nextBlocks: typeof page.blocks = [];

    for (const block of page.blocks) {
      const data = { ...(block.data as Record<string, unknown>) };
      let dirty = false;

      if (block.type === "text") {
        if (!(typeof data.html === "string" && data.html.trim()) && data.markdown) {
          data.html = sanitizeRichText(
            simpleMarkdown(String(data.markdown)),
            "full",
          );
          delete data.markdown;
          dirty = true;
          changedFields += 1;
        }
      }

      if (block.type === "answer") {
        if (!(typeof data.html === "string" && data.html.trim()) && data.text) {
          const plain = String(data.text);
          const srcHtml = answerSrc.get(page.path);
          if (srcHtml) {
            const srcText = cheerio.load(`<div>${srcHtml}</div>`)("div").text().trim();
            if (srcText === plain.trim()) {
              data.html = sanitizeRichText(srcHtml, "basic");
            } else {
              data.html = plainToHtml(plain);
            }
          } else {
            data.html = plainToHtml(plain);
          }
          delete data.text;
          dirty = true;
          changedFields += 1;
        }
      }

      if (block.type === "faq" && Array.isArray(data.items)) {
        data.items = (data.items as Array<Record<string, unknown>>).map((it) => {
          if (
            !(typeof it.answerHtml === "string" && it.answerHtml.trim()) &&
            it.answer
          ) {
            dirty = true;
            changedFields += 1;
            const { answer: _a, ...rest } = it;
            void _a;
            return {
              ...rest,
              answerHtml: plainToHtml(String(it.answer)),
            };
          }
          return it;
        });
      }

      if (block.type === "cards" && Array.isArray(data.items)) {
        data.items = (data.items as Array<Record<string, unknown>>).map((it) => {
          if (
            !(typeof it.textHtml === "string" && it.textHtml.trim()) &&
            it.text
          ) {
            dirty = true;
            changedFields += 1;
            return { ...it, textHtml: inlineToHtml(String(it.text)), text: null };
          }
          return it;
        });
      }

      if (block.type === "cases" && Array.isArray(data.items)) {
        data.items = (data.items as Array<Record<string, unknown>>).map((it) => {
          if (
            !(typeof it.textHtml === "string" && it.textHtml.trim()) &&
            it.text
          ) {
            dirty = true;
            changedFields += 1;
            const { text: _t, ...rest } = it;
            void _t;
            return {
              ...rest,
              textHtml: inlineToHtml(String(it.text)),
            };
          }
          return it;
        });
      }

      if (block.type === "team" && Array.isArray(data.people)) {
        data.people = (data.people as Array<Record<string, unknown>>).map((p) => {
          if (
            !(typeof p.textHtml === "string" && p.textHtml.trim()) &&
            p.text
          ) {
            dirty = true;
            changedFields += 1;
            return { ...p, textHtml: inlineToHtml(String(p.text)), text: "" };
          }
          return p;
        });
      }

      if (dirty) {
        // валидация через схему
        const parsed = parseBlockData(block.type, data);
        nextBlocks.push({ ...block, data: parsed as Prisma.JsonValue });
        pageDirty = true;
        changedBlocks += 1;
        report.push(`${page.path} · ${block.type} · ${block.id}`);
      } else {
        nextBlocks.push(block);
      }
    }

    if (!pageDirty) continue;
    if (dry) continue;

    await prisma.$transaction(async (tx) => {
      await tx.pageRevision.create({
        data: {
          pageId: page.id,
          snapshot: {
            page: {
              id: page.id,
              path: page.path,
              title: page.title,
              template: page.template,
              status: page.status,
            },
            blocks: page.blocks.map((b) => ({
              id: b.id,
              type: b.type,
              sortOrder: b.sortOrder,
              data: b.data,
              isHidden: b.isHidden,
              anchor: b.anchor,
            })),
          } as Prisma.InputJsonValue,
          note: "до миграции rich text",
        },
      });
      for (const b of nextBlocks) {
        if (report.some((r) => r.endsWith(b.id))) {
          await tx.block.update({
            where: { id: b.id },
            data: { data: b.data as Prisma.InputJsonValue },
          });
        }
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun: dry,
        pages: pages.length,
        changedBlocks,
        changedFields,
        report: report.slice(0, 50),
        reportTruncated: report.length > 50,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
