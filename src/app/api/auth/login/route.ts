import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getPasswordDigest, hashPasswordCandidate, isPasswordConfigured } from "@/lib/auth";

const LOGIN_ERROR_MESSAGE = "Invalid password. Please try again.";

export async function POST(request: Request) {
  if (!isPasswordConfigured()) {
    return NextResponse.json({ error: "Portal password not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({} as { password?: string }));
  const providedPassword = typeof body.password === "string" ? body.password : "";

  if (!providedPassword.trim()) {
    return NextResponse.json({ error: LOGIN_ERROR_MESSAGE }, { status: 401 });
  }

  const [expectedDigest, providedDigest] = await Promise.all([
    getPasswordDigest(),
    hashPasswordCandidate(providedPassword),
  ]);

  if (expectedDigest !== providedDigest) {
    const response = NextResponse.json({ error: LOGIN_ERROR_MESSAGE }, { status: 401 });
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: expectedDigest,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  return response;
}
