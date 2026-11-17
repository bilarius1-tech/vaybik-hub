import { z } from "zod";

export const redirectCodeSchema = z.union([z.literal(301), z.literal(302)]);

export const redirectMatchSchema = z.enum(["EXACT", "PREFIX"]);

export const redirectInputSchema = z.object({
  fromPath: z
    .string()
    .min(1)
    .refine((p) => p.startsWith("/"), "from должен начинаться с /")
    .refine((p) => !p.startsWith("/admin"), "from не может быть под /admin"),
  toPath: z
    .string()
    .min(1)
    .refine(
      (p) => p.startsWith("/") || /^https:\/\//i.test(p),
      "to — путь /... или https://...",
    ),
  code: redirectCodeSchema.default(301),
  match: redirectMatchSchema.default("EXACT"),
  isActive: z.boolean().default(true),
  note: z.string().max(500).optional().nullable(),
  source: z.enum(["manual", "import"]).default("manual"),
});

export type RedirectLike = {
  id?: string;
  fromPath: string;
  toPath: string;
  match: "EXACT" | "PREFIX";
  isActive: boolean;
};

export type RedirectValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Предложение спрямить цепочку A→B→C в A→C */
  suggestedToPath?: string;
};

/**
 * Валидация редиректа относительно уже существующих.
 * Петли и цепочки длиннее 1 — предупреждение с предложением A→C.
 */
export function validateRedirect(
  input: RedirectLike,
  existing: RedirectLike[],
): RedirectValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let suggestedToPath: string | undefined;

  if (input.fromPath === input.toPath) {
    errors.push("from и to не должны совпадать");
  }

  const others = existing.filter(
    (r) => r.id !== input.id && r.isActive,
  );

  const dup = others.find((r) => r.fromPath === input.fromPath);
  if (dup) {
    errors.push(`уже есть редирект с fromPath «${input.fromPath}»`);
  }

  if (input.match === "PREFIX") {
    for (const r of others) {
      if (r.match !== "PREFIX") continue;
      if (
        input.fromPath.startsWith(r.fromPath) ||
        r.fromPath.startsWith(input.fromPath)
      ) {
        errors.push(
          `PREFIX «${input.fromPath}» пересекается с «${r.fromPath}»`,
        );
      }
    }
  }

  // Цепочка: A→B при существующем B→C
  if (input.toPath.startsWith("/")) {
    const next = others.find(
      (r) =>
        r.match === "EXACT"
          ? r.fromPath === input.toPath
          : input.toPath.startsWith(r.fromPath),
    );
    if (next) {
      warnings.push(
        `цепочка: ${input.fromPath} → ${input.toPath} → ${next.toPath}; лучше спрямить`,
      );
      suggestedToPath = next.toPath;
    }
  }

  // Петля: A→B и уже есть B→A
  if (input.toPath.startsWith("/")) {
    const back = others.find(
      (r) =>
        r.fromPath === input.toPath &&
        (r.match === "EXACT"
          ? r.toPath === input.fromPath
          : input.fromPath.startsWith(r.toPath)),
    );
    if (back) {
      errors.push(
        `петля с редиректом «${back.fromPath}» → «${back.toPath}»`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    suggestedToPath,
  };
}
