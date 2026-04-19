import { NextRequest, NextResponse } from "next/server";
import { signToken, COOKIE, PENDING_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== (process.env.ADMIN_PASSWORD ?? "").trim()) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Check if 2FA is configured
  const { data: setting } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "totp_enabled")
    .maybeSingle();

  const twoFAEnabled = setting?.value === "true";

  if (twoFAEnabled) {
    // Issue a short-lived pending token — user must verify TOTP next
    const pendingToken = await signToken({ pending: true }, "5m");
    const res = NextResponse.json({ step: "2fa" });
    res.cookies.set(PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
      path: "/",
    });
    return res;
  }

  // No 2FA — grant full session immediately
  const token = await signToken({ role: "admin" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
