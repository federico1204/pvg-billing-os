import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const memberId = searchParams.get("member");

  let query = db.from("team_payments").select("*").order("payment_date", { ascending: false });
  if (month) query = query.eq("period_month", parseInt(month));
  if (year) query = query.eq("period_year", parseInt(year));
  if (memberId) query = query.eq("team_member_id", parseInt(memberId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    teamMemberId, personName, paymentDate, amount, currency,
    paymentMethod, referenceNumber, periodMonth, periodYear,
    paymentType, notes, alsoLogAsExpense,
  } = body;

  if (!personName || !paymentDate || !amount) {
    return NextResponse.json({ error: "personName, paymentDate, and amount are required" }, { status: 400 });
  }

  // Insert team payment
  const { data: payment, error } = await db.from("team_payments").insert({
    team_member_id: teamMemberId ?? null,
    person_name: personName,
    payment_date: paymentDate,
    amount,
    currency: currency ?? "USD",
    payment_method: paymentMethod ?? "SINPE",
    reference_number: referenceNumber,
    period_month: periodMonth ?? new Date(paymentDate).getMonth() + 1,
    period_year: periodYear ?? new Date(paymentDate).getFullYear(),
    payment_type: paymentType ?? "salary",
    notes,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally also create an expense record
  let expenseId: number | null = null;
  if (alsoLogAsExpense) {
    const expenseNotes = `Pagos: Team payment to ${personName} — ${currency} ${amount} — Ref: ${referenceNumber ?? "N/A"}`;
    const { data: expense } = await db.from("expenses").insert({
      date: paymentDate,
      description: `Payroll — ${personName}`,
      amount,
      currency: currency ?? "USD",
      category: "Payroll & Salaries",
      vendor: personName,
      notes: expenseNotes,
    }).select("id").single();

    if (expense) {
      expenseId = expense.id;
      // Link the expense back
      await db.from("team_payments").update({ linked_expense_id: expenseId }).eq("id", (payment as any).id);
    }
  }

  return NextResponse.json({ ...payment, linkedExpenseId: expenseId }, { status: 201 });
}
