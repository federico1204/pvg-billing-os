import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: observations }, { data: routines }] = await Promise.all([
    db.from("agent_observations")
      .select("*")
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("agent_routines")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    observations: observations ?? [],
    routines: routines ?? [],
  });
}
