import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, getPasswordDigest, isPasswordConfigured } from "@/lib/auth";

const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth/login"];
const STATIC_PATH_PATTERN = /^\/(?:_next\/static|_next\/image|_next\/data|favicon\.ico|robots\.txt|manifest\.json)(?:\/|$)/;

function isHtmlRequest(request: NextRequest): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

function buildReturnUrl(request: NextRequest): string {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith("/")) {
    return "/";
  }
  if (pathname.startsWith("//")) {
    return "/";
  }
  return `${pathname}${search}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (STATIC_PATH_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  if (!isPasswordConfigured()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Portal password is not configured." },
        { status: 503 },
      );
    }

    if (pathname.startsWith("/login")) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!cookieValue) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    if (isHtmlRequest(request)) {
      loginUrl.searchParams.set("returnUrl", buildReturnUrl(request));
    }

    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const expectedDigest = await getPasswordDigest();
  if (cookieValue !== expectedDigest) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Authentication required." }, { status: 401 });
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    if (isHtmlRequest(request)) {
      loginUrl.searchParams.set("returnUrl", buildReturnUrl(request));
    }

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|manifest\\.json).*)",
  ],
};
