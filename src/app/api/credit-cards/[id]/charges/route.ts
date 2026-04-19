import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await db
    .from("credit_card_charges")
    .select("*")
    .eq("card_id", id)
    .order("charge_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const { chargeDate, merchant, amount, currency, category, description, isRecurring } = body;

  const date = new Date(chargeDate);
  const statementMonth = date.getMonth() + 1;
  const statementYear = date.getFullYear();

  const { data, error } = await db.from("credit_card_charges").insert({
    card_id: parseInt(id),
    charge_date: chargeDate,
    merchant,
    amount,
    currency: currency ?? "USD",
    category,
    description,
    statement_month: statementMonth,
    statement_year: statementYear,
    is_recurring: isRecurring ?? false,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const chargeId = searchParams.get("chargeId");
  if (!chargeId) return NextResponse.json({ error: "chargeId required" }, { status: 400 });

  const { error } = await db.from("credit_card_charges").delete().eq("id", chargeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
