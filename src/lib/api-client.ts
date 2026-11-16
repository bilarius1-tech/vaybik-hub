/** Клиентские fetch-хелперы с basePath /admin */
const BASE = "/admin";

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data?: T; error?: { code: string; message: string }; status: number }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      status: res.status,
      error: json.error || { code: "ERROR", message: "Ошибка запроса" },
    };
  }
  return { status: res.status, data: json as T };
}
