import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/require";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: { code, message, ...extra } },
    { status },
  );
}

export function handleRouteError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.code, err.message, err.status);
  }
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "ZodError") {
    const zerr = err as {
      issues?: { message: string; path?: (string | number)[] }[];
    };
    const issue = zerr.issues?.[0];
    let message = issue?.message || "Ошибка валидации";
    // Английские дефолты Zod → по-русски
    if (/^Too small: expected string to have >=\s*1/i.test(message)) {
      const field = issue?.path?.map(String).join(".") || "";
      const labels: Record<string, string> = {
        password: "Введите пароль",
        name: "Укажите название",
        externalId: "Укажите externalId",
        code: "Введите код",
        email: "Укажите email",
      };
      message = labels[field] || "Заполните обязательное поле";
    }
    return jsonError("VALIDATION", message, 400);
  }
  if (err && typeof err === "object" && "status" in err && "code" in err) {
    const e = err as {
      status: number;
      code: string;
      message: string;
      extra?: Record<string, unknown>;
    };
    return jsonError(e.code, e.message || "Ошибка", e.status, e.extra);
  }
  console.error(err);
  return jsonError("INTERNAL", "Внутренняя ошибка", 500);
}
