import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const { name, email, domain, defaultCategory, defaultCurrency, isRecurring, typicalAmount, notes } = body;

  const { data, error } = await db.from("vendors").update({
    name,
    email: email || null,
    domain: domain || null,
    default_category: defaultCategory || null,
    default_currency: defaultCurrency || "USD",
    is_recurring: isRecurring ?? false,
    typical_amount: typicalAmount ? parseFloat(typicalAmount) : null,
    notes: notes || null,
  }).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await db.from("vendors").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
