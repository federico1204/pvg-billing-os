import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db
    .from("recurring_invoices")
    .select("*, clients(id, commercial_name, llc_name, email, billing_email, preferred_language)")
    .order("next_run_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    clientId, name, description, amount, currency, frequency,
    dayOfMonth, serviceCategory, nextRunDate, autoSend,
  } = body;

  if (!clientId || !name || !amount || !nextRunDate) {
    return NextResponse.json({ error: "clientId, name, amount, and nextRunDate are required" }, { status: 400 });
  }

  const { data, error } = await db.from("recurring_invoices").insert({
    client_id: clientId,
    name,
    description,
    amount,
    currency: currency ?? "USD",
    frequency: frequency ?? "monthly",
    day_of_month: dayOfMonth ?? 1,
    service_category: serviceCategory,
    next_run_date: nextRunDate,
    auto_send: autoSend ?? false,
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
