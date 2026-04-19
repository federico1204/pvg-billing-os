import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await db.from("agent_routines").select("*").order("created_at");
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { data, error } = await db.from("agent_routines").insert({
    name: body.name,
    description: body.description,
    routine_type: body.routineType,
    frequency: body.frequency ?? "weekly",
    is_active: body.isActive ?? true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, isActive, frequency } = await req.json();
  const updates: any = {};
  if (isActive !== undefined) updates.is_active = isActive;
  if (frequency !== undefined) updates.frequency = frequency;
  const { data, error } = await db.from("agent_routines").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
