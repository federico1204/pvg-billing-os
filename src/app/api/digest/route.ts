import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runDigest } from "@/lib/digest";

// Manual trigger — authenticated dashboard user
export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runDigest(true);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
