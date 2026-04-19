import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;

  const [{ data: cards, error }, { data: charges }, { data: statements }] = await Promise.all([
    db.from("credit_cards").select("*").eq("is_active", true).order("name"),
    db.from("credit_card_charges")
      .select("card_id, amount, currency, charge_date, statement_month, statement_year")
      .gte("charge_date", `${currentYear}-01-01`),
    db.from("credit_card_statements")
      .select("*")
      .eq("statement_year", currentYear)
      .order("statement_month", { ascending: false }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (cards ?? []).map((card: any) => {
    const cardCharges = (charges ?? []).filter((c: any) => c.card_id === card.id);
    const thisMonthCharges = cardCharges.filter((c: any) => c.charge_date >= monthStart);
    const ytdCharges = cardCharges;
    const latestStatement = (statements ?? [])
      .filter((s: any) => s.card_id === card.id)
      .sort((a: any, b: any) => b.statement_year * 100 + b.statement_month - (a.statement_year * 100 + a.statement_month))[0] ?? null;

    const thisMonthSpend = thisMonthCharges.reduce((s: number, c: any) => s + parseFloat(c.amount ?? 0), 0);
    const ytdSpend = ytdCharges.reduce((s: number, c: any) => s + parseFloat(c.amount ?? 0), 0);

    return {
      ...card,
      thisMonthSpend,
      ytdSpend,
      latestStatement,
      chargeCount: cardCharges.length,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, bank, lastFour, cardType, creditLimit, currency, statementCloseDay, paymentDueDays, color, notes } = body;

  const { data, error } = await db.from("credit_cards").insert({
    name,
    bank,
    last_four: lastFour,
    card_type: cardType ?? "visa",
    credit_limit: creditLimit ?? 0,
    currency: currency ?? "USD",
    statement_close_day: statementCloseDay,
    payment_due_days: paymentDueDays ?? 21,
    color: color ?? "#6366f1",
    notes,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
