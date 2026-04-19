import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateSecret, getTOTPUri, validateTOTP } from "@/lib/totp";
import { db } from "@/lib/db";
import QRCode from "qrcode";
// Use SVG output — no canvas dependency, works in all serverless environments

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check current status
  const { data: enabledRow } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "totp_enabled")
    .maybeSingle();

  return NextResponse.json({ enabled: enabledRow?.value === "true" });
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.action === "generate") {
    // Generate a new secret and return QR code as SVG (no canvas needed)
    const secret = generateSecret();
    const uri = getTOTPUri(secret);
    const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 2, width: 240 });
    return NextResponse.json({ secret, qrSvg });
  }

  if (body.action === "confirm") {
    const { secret, code } = body;
    if (!secret || !code) return NextResponse.json({ error: "Missing secret or code" }, { status: 400 });

    const valid = validateTOTP(secret, code.toString());
    if (!valid) return NextResponse.json({ error: "Invalid code — scan again and retry" }, { status: 400 });

    // Save to DB
    await db.from("app_settings").upsert({ key: "totp_secret", value: secret }, { onConflict: "key" });
    await db.from("app_settings").upsert({ key: "totp_enabled", value: "true" }, { onConflict: "key" });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "disable") {
    await db.from("app_settings").upsert({ key: "totp_enabled", value: "false" }, { onConflict: "key" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
