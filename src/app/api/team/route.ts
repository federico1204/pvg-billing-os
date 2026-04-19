import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// All name variants to try matching (full name + first+last shorthand)
function nameVariants(personName: string): string[] {
  const lower = personName.toLowerCase();
  const parts = lower.split(" ");
  const variants = [lower];
  // "David Porras" → also try "David Porras Castro" reverse (first + last word only)
  if (parts.length >= 2) variants.push(`${parts[0]} ${parts[parts.length - 1]}`);
  return variants;
}

// Match an expense row to a team member by vendor or notes
function matchesMember(expense: any, personName: string): boolean {
  const variants = nameVariants(personName);

  if (expense.vendor) {
    const v = expense.vendor.toLowerCase();
    if (variants.some(n => v.includes(n) || n.includes(v))) return true;
  }

  if (expense.notes) {
    const notesLower = expense.notes.toLowerCase();
    if (variants.some(n => notesLower.includes(n))) return true;
  }
  return false;
}

// For bulk notes like "David Porras Castro (1,500 USD)" or "David Porras (1,500 USD)",
// extract the individual USD amount; for individual entries return the full amount.
function extractAmount(expense: any, personName: string): number {
  const variants = nameVariants(personName);

  // Individual entry: vendor matches person → use expense.amount directly
  if (expense.vendor) {
    const v = expense.vendor.toLowerCase();
    const isIndividual = variants.some(n => v.includes(n) || n.includes(v));
    if (isIndividual) return parseFloat(expense.amount ?? 0);
  }

  // Bulk entry: parse amount from notes field — try each name variant
  if (expense.notes) {
    for (const variant of variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = expense.notes.match(
        new RegExp(escaped + "\\s*\\(([\\d,\\.]+)\\s*(USD|CRC)[^)]*\\)", "i")
      );
      if (match) {
        const raw = parseFloat(match[1].replace(/,/g, ""));
        // CRC amounts already converted to USD equivalent in notes (e.g. "400,000 CRC / 873.36 USD")
        // We want the USD figure — look for the slash pattern
        if (match[2].toUpperCase() === "CRC") {
          const usdMatch = expense.notes.match(
            new RegExp(escaped + "[^)]*\\/(\\s*[\\d,\\.]+)\\s*USD", "i")
          );
          return usdMatch ? parseFloat(usdMatch[1].replace(/,/g, "")) : 0;
        }
        return raw;
      }
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
      // Exclude raw bank-statement TEF entries (duplicates) and CRC-denominated entries
      .not("vendor", "like", "TEF A%")
      .not("vendor", "like", "Payroll CRC%")
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
