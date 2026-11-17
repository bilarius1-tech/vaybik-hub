/** Клиентские fetch-хелперы с basePath /admin */
const BASE = "/admin";

export type ApiResult<T> = {
  data?: T;
  error?: { code: string; message: string; [k: string]: unknown };
  status: number;
};

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
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

/** multipart без Content-Type (boundary ставит браузер) */
export async function apiForm<T>(
  path: string,
  form: FormData,
  init?: Omit<RequestInit, "body">,
): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    ...init,
    body: form,
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
