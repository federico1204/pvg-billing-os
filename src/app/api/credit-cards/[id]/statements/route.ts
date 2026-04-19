import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await db
    .from("credit_card_statements")
    .select("*")
    .eq("card_id", id)
    .order("statement_year", { ascending: false })
    .order("statement_month", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const { statementMonth, statementYear, closingBalance, minimumPayment, paymentDueDate, paidAmount, paidDate, status, notes } = body;

  const { data, error } = await db.from("credit_card_statements").upsert({
    card_id: parseInt(id),
    statement_month: statementMonth,
    statement_year: statementYear,
    closing_balance: closingBalance ?? 0,
    minimum_payment: minimumPayment ?? 0,
    payment_due_date: paymentDueDate,
    paid_amount: paidAmount ?? 0,
    paid_date: paidDate,
    status: status ?? "open",
    notes,
  }, { onConflict: "card_id,statement_month,statement_year" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
