import { NextRequest, NextResponse } from "next/server";

/** Имя cookie — дублируем константу, чтобы middleware оставался Edge-safe */
const SESSION_COOKIE = "vaybik_session";

const PUBLIC_PREFIXES = [
  "/login",
  "/invite",
  "/api/auth/login",
  "/api/auth/2fa",
  "/api/invites/accept",
  "/api/health",
  "/api/public",
];

function isPublic(pathname: string): boolean {
  if (pathname.startsWith("/api/auth/2fa/setup")) return false;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  // В production — без unsafe-eval (TZ §9). В development React DevTools требует eval.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return securityHeaders(NextResponse.next());
  }

  if (isPublic(pathname)) {
    return securityHeaders(NextResponse.next());
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return securityHeaders(
        NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Требуется вход" } },
          { status: 401 },
        ),
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return securityHeaders(NextResponse.redirect(url));
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
