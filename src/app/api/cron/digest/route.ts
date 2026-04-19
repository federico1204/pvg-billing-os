import { NextRequest, NextResponse } from "next/server";
import { runDigest } from "@/lib/digest";

// Called by Vercel Cron on Monday and Thursday at 8AM Costa Rica time (= 2PM UTC, UTC-6)
export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron (or allow manual trigger with secret)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDigest();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
