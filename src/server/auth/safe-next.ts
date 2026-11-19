/**
 * Безопасный next для редиректа внутри хаба (/admin basePath уже в URL роутера).
 * Только относительные пути; без open-redirect.
 */
export function sanitizeHubNext(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let path = String(raw).trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    const app = (process.env.APP_URL || "").trim();
    if (!app) return null;
    try {
      const allowed = new URL(app);
      const u = new URL(path);
      if (u.protocol !== allowed.protocol || u.host !== allowed.host) {
        return null;
      }
      path = `${u.pathname}${u.search}`;
      const basePath = allowed.pathname.replace(/\/$/, "") || "";
      if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) {
        path = path === basePath ? "/" : path.slice(basePath.length) || "/";
      }
    } catch {
      return null;
    }
  }

  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.includes("://")) return null;
  if (path.includes("\\") || path.includes("\0")) return null;
  if (path === "/login" || path.startsWith("/login?")) return null;
  if (path === "/login/2fa" || path.startsWith("/login/2fa?")) return null;
  return path.slice(0, 1024);
}
