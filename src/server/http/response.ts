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
  if (err && typeof err === "object" && "status" in err && "code" in err) {
    const e = err as { status: number; code: string; message: string };
    return jsonError(e.code, e.message || "Ошибка", e.status);
  }
  console.error(err);
  return jsonError("INTERNAL", "Внутренняя ошибка", 500);
}
