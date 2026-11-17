import type { PrismaClient } from "@prisma/client";

export type RedirectRule = {
  id: string;
  fromPath: string;
  toPath: string;
  code: number;
  match: "EXACT" | "PREFIX";
};

const hitBuffer = new Map<string, { hits: number; lastHitAt: Date }>();

export function matchRedirect(
  pathname: string,
  rules: RedirectRule[],
): { to: string; code: number; id: string } | null {
  // EXACT first
  for (const r of rules) {
    if (r.match !== "EXACT") continue;
    if (r.fromPath === pathname) {
      if (r.toPath === pathname) continue; // петля
      return { to: r.toPath, code: r.code || 301, id: r.id };
    }
  }
  // PREFIX longest first
  const prefixes = rules
    .filter((r) => r.match === "PREFIX")
    .sort((a, b) => b.fromPath.length - a.fromPath.length);
  for (const r of prefixes) {
    if (pathname === r.fromPath || pathname.startsWith(r.fromPath)) {
      const tail = pathname.slice(r.fromPath.length);
      const to = r.toPath.endsWith("/")
        ? `${r.toPath}${tail.replace(/^\//, "")}`
        : `${r.toPath}${tail}`;
      // петля
      if (to === pathname) continue;
      return { to, code: r.code || 301, id: r.id };
    }
  }
  return null;
}

export function noteRedirectHit(id: string): void {
  const cur = hitBuffer.get(id) || { hits: 0, lastHitAt: new Date() };
  cur.hits += 1;
  cur.lastHitAt = new Date();
  hitBuffer.set(id, cur);
}

export async function flushRedirectHits(db: PrismaClient): Promise<void> {
  if (hitBuffer.size === 0) return;
  const entries = [...hitBuffer.entries()];
  hitBuffer.clear();
  for (const [id, data] of entries) {
    try {
      await db.redirect.update({
        where: { id },
        data: {
          hits: { increment: data.hits },
          lastHitAt: data.lastHitAt,
        },
      });
    } catch (err) {
      console.warn("[site] redirect hit flush failed", id, err);
    }
  }
}

export async function loadRedirects(db: PrismaClient): Promise<RedirectRule[]> {
  const rows = await db.redirect.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fromPath: true,
      toPath: true,
      code: true,
      match: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fromPath: r.fromPath,
    toPath: r.toPath,
    code: r.code,
    match: r.match,
  }));
}

/** Собрать Location с сохранением query */
export function locationWithQuery(
  toPath: string,
  search: string,
): string {
  if (!search || search === "?") return toPath;
  if (toPath.includes("?")) {
    return `${toPath}&${search.replace(/^\?/, "")}`;
  }
  return `${toPath}${search.startsWith("?") ? search : `?${search}`}`;
}
