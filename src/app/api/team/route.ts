import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Get team members with payment summaries
  const { data: members, error } = await db
    .from("team_costs")
    .select("*")
    .order("person_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get payment totals per member
  const { data: payments } = await db
    .from("team_payments")
    .select("team_member_id, amount, currency, payment_date, period_month, period_year")
    .order("payment_date", { ascending: false });

  const paymentsByMember: Record<number, any[]> = {};
  for (const p of payments ?? []) {
    if (!paymentsByMember[p.team_member_id]) paymentsByMember[p.team_member_id] = [];
    paymentsByMember[p.team_member_id].push(p);
  }

  const enriched = (members ?? []).map((m: any) => {
    const memberPayments = paymentsByMember[m.id] ?? [];
    const ytdUSD = memberPayments
      .filter((p: any) => p.period_year === currentYear && p.currency === "USD")
      .reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
    const thisMonthUSD = memberPayments
      .filter((p: any) => p.period_year === currentYear && p.period_month === currentMonth && p.currency === "USD")
      .reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
    const lastPayment = memberPayments[0] ?? null;
    return { ...m, ytdPaid: ytdUSD, thisMonthPaid: thisMonthUSD, lastPayment, paymentCount: memberPayments.length };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { personName, role, monthlyCost, currency, sinpeNumber, iban, idNumber, paymentMethodPreferred, notes, isActive } = body;

  const { data, error } = await db.from("team_costs").insert({
    person_name: personName,
    role,
    monthly_cost: monthlyCost ?? 0,
    currency: currency ?? "USD",
    sinpe_number: sinpeNumber,
    iban,
    id_number: idNumber,
    payment_method_preferred: paymentMethodPreferred ?? "SINPE",
    notes,
    is_active: isActive ?? true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
