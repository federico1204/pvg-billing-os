import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const {
    name, description, amount, currency, frequency,
    dayOfMonth, serviceCategory, nextRunDate, autoSend, isActive,
  } = body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (amount !== undefined) updates.amount = amount;
  if (currency !== undefined) updates.currency = currency;
  if (frequency !== undefined) updates.frequency = frequency;
  if (dayOfMonth !== undefined) updates.day_of_month = dayOfMonth;
  if (serviceCategory !== undefined) updates.service_category = serviceCategory;
  if (nextRunDate !== undefined) updates.next_run_date = nextRunDate;
  if (autoSend !== undefined) updates.auto_send = autoSend;
  if (isActive !== undefined) updates.is_active = isActive;

  const { data, error } = await db.from("recurring_invoices").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await db.from("recurring_invoices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
