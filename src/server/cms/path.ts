import { z } from "zod";

/** Путь страницы: "/", "/uslugi/landing/" — латиница/цифры/дефис, со слэшем в конце */
export const pagePathSchema = z
  .string()
  .min(1)
  .refine((p) => p.startsWith("/"), "путь должен начинаться с /")
  .refine((p) => p.endsWith("/"), "путь должен заканчиваться на /")
  .refine((p) => !p.startsWith("/admin"), "путь не может быть под /admin")
  .refine(
    (p) => p === "/" || /^\/[a-z0-9/-]+\/$/.test(p),
    "только латиница, цифры, дефис и /",
  );

export function normalizePagePath(path: string): string {
  let p = path.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p !== "/" && !p.endsWith("/")) p = `${p}/`;
  return p;
}
