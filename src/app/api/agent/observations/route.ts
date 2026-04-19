import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Dismiss an observation
export async function PATCH(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  await db.from("agent_observations").update({ is_dismissed: true }).eq("id", id);
  return NextResponse.json({ ok: true });
}

// Clear all dismissed
export async function DELETE() {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.from("agent_observations").update({ is_dismissed: true }).eq("is_dismissed", false);
  return NextResponse.json({ ok: true });
}
