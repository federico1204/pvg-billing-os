import { NextRequest, NextResponse } from "next/server";
import { getPendingSession, signToken, COOKIE, PENDING_COOKIE } from "@/lib/auth";
import { validateTOTP } from "@/lib/totp";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const isPending = await getPendingSession();
  if (!isPending) {
    return NextResponse.json({ error: "No pending session — please enter password first" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const { data: secretRow } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "totp_secret")
    .maybeSingle();

  if (!secretRow?.value) {
    return NextResponse.json({ error: "2FA not configured" }, { status: 500 });
  }

  const valid = validateTOTP(secretRow.value, code.toString().replace(/\s/g, ""));
  if (!valid) {
    return NextResponse.json({ error: "Invalid code — try again" }, { status: 401 });
  }

  // Issue full session
  const token = await signToken({ role: "admin" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  // Clear pending cookie
  res.cookies.set(PENDING_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
