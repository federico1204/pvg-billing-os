import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Match an expense row to a team member by vendor or notes
function matchesMember(expense: any, personName: string): boolean {
  const nameLower = personName.toLowerCase();
  const parts = nameLower.split(" ");

  if (expense.vendor) {
    const v = expense.vendor.toLowerCase();
    if (v.includes(nameLower) || nameLower.includes(v)) return true;
    // First + last name partial match (handles DAVID PORRAS CASTRO → "David Porras Castro")
    if (parts.length >= 2 && v.includes(parts[0]) && v.includes(parts[parts.length - 1])) return true;
  }

  if (expense.notes) {
    return expense.notes.toLowerCase().includes(nameLower);
  }
  return false;
}

// For bulk notes like "David Porras Castro (1,500 USD)", extract the individual amount
function extractAmount(expense: any, personName: string): number {
  // Individual entry: vendor matches person → use expense.amount directly
  if (expense.vendor) {
    const v = expense.vendor.toLowerCase();
    const n = personName.toLowerCase();
    const parts = n.split(" ");
    const isIndividual =
      v.includes(n) || n.includes(v) ||
      (parts.length >= 2 && v.includes(parts[0]) && v.includes(parts[parts.length - 1]));
    if (isIndividual) return parseFloat(expense.amount ?? 0);
  }

  // Bulk entry: parse amount from notes field
  if (expense.notes) {
    const escaped = personName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = expense.notes.match(
      new RegExp(escaped + "\\s*\\(([\\d,\\.]+)\\s*(USD|CRC)[^)]*\\)", "i")
    );
    if (match) {
      const raw = parseFloat(match[1].replace(/,/g, ""));
      return match[2].toUpperCase() === "USD" ? raw : 0; // skip CRC for USD totals
    }
  }
  return 0;
}

export async function GET(_req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const yearStart = `${currentYear}-01-01`;
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;

  const [{ data: members, error }, { data: payrollExpenses }] = await Promise.all([
    db.from("team_costs").select("*").order("person_name"),
    db.from("expenses")
      .select("amount, date, currency, vendor, notes, category")
      .eq("category", "Payroll & Salaries")
      .gte("date", yearStart)
      .order("date", { ascending: false }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const expenses = payrollExpenses ?? [];

  const enriched = (members ?? []).map((m: any) => {
    const matched = expenses.filter(e => matchesMember(e, m.person_name));

    const ytdPaid = matched.reduce((s: number, e: any) => s + extractAmount(e, m.person_name), 0);
    const thisMonthPaid = matched
      .filter((e: any) => e.date >= monthStart)
      .reduce((s: number, e: any) => s + extractAmount(e, m.person_name), 0);

    const latest = matched[0] ?? null;
    const lastPayment = latest
      ? {
          payment_date: latest.date,
          amount: extractAmount(latest, m.person_name),
          currency: "USD",
          payment_method: "Expenses",
        }
      : null;

    return { ...m, ytdPaid, thisMonthPaid, lastPayment, paymentCount: matched.length };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { personName, role, monthlyCost, currency, iban, idNumber, paymentMethodPreferred, notes, isActive } = body;

  const { data, error } = await db.from("team_costs").insert({
    person_name: personName,
    role,
    monthly_cost: monthlyCost ?? 0,
    currency: currency ?? "USD",
    iban,
    id_number: idNumber,
    payment_method_preferred: paymentMethodPreferred ?? "bank_transfer",
    notes,
    is_active: isActive ?? true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
