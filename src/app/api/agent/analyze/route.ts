import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function fmt(n: number, cur = "USD") {
  return cur === "CRC"
    ? `₡${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  // Pull all financial data in parallel
  const [
    { data: invoices },
    { data: expenses },
    { data: clients },
    { data: payments },
    { data: recurring },
  ] = await Promise.all([
    db.from("invoices").select("*").gte("created_at", yearStart).order("due_date", { ascending: false }),
    db.from("expenses").select("amount, date, category, vendor, currency").gte("date", yearStart),
    db.from("clients").select("id, commercial_name, email, preferred_language"),
    db.from("payments").select("amount, paid_at, invoice_id").gte("paid_at", yearStart),
    db.from("recurring_invoices").select("*, clients(commercial_name)").eq("is_active", true),
  ]);

  const allInvoices = invoices ?? [];
  const allExpenses = expenses ?? [];

  // Key metrics
  const totalBilled = allInvoices.reduce((s: number, i: any) => s + parseFloat(i.total_amount ?? 0), 0);
  const totalCollected = allInvoices.reduce((s: number, i: any) => s + parseFloat(i.paid_amount ?? 0), 0);
  const totalOutstanding = totalBilled - totalCollected;
  const overdueInvoices = allInvoices.filter((i: any) => {
    if (i.billing_status === "PAID" || i.billing_status === "CANCELLED") return false;
    return i.due_date && new Date(i.due_date) < today;
  });
  const overdueAmount = overdueInvoices.reduce((s: number, i: any) => s + Math.max(0, parseFloat(i.total_amount ?? 0) - parseFloat(i.paid_amount ?? 0)), 0);

  const totalExpenses = allExpenses.filter((e: any) => e.currency === "USD").reduce((s: number, e: any) => s + parseFloat(e.amount ?? 0), 0);

  // Client payment patterns — detect bi-monthly payers, chronic late payers, etc.
  const clientInvoiceMap: Record<string, any[]> = {};
  for (const inv of allInvoices) {
    const key = (inv as any).client_name ?? "Unknown";
    if (!clientInvoiceMap[key]) clientInvoiceMap[key] = [];
    clientInvoiceMap[key].push(inv);
  }

  const clientPatterns: string[] = [];
  for (const [clientName, invs] of Object.entries(clientInvoiceMap)) {
    if (invs.length < 2) continue;

    // Check for bi-monthly billing (2 invoices same month)
    const monthGroups: Record<string, number> = {};
    for (const inv of invs) {
      const m = (inv.due_date ?? inv.created_at ?? "").slice(0, 7);
      if (m) monthGroups[m] = (monthGroups[m] || 0) + 1;
    }
    const biMonthlyMonths = Object.values(monthGroups).filter(c => c >= 2).length;
    if (biMonthlyMonths >= 2) {
      const amounts = [...new Set(invs.map((i: any) => parseFloat(i.total_amount ?? 0)))];
      clientPatterns.push(`${clientName}: Bills ${biMonthlyMonths} months with 2+ invoices/month — likely has 2 entities or pays in 2 installments. Amounts seen: ${amounts.map(a => fmt(a)).join(", ")}.`);
    }

    // Chronic late payers
    const lateCount = invs.filter((i: any) => {
      if (i.billing_status !== "PAID") return false;
      const due = new Date(i.due_date);
      const paid = i.updated_at ? new Date(i.updated_at) : null;
      return paid && paid > due;
    }).length;
    if (lateCount >= 2) {
      clientPatterns.push(`${clientName}: Has paid late ${lateCount}x this year. Consider stricter payment terms.`);
    }
  }

  const expenseByCategory: Record<string, number> = {};
  for (const e of allExpenses.filter((e: any) => e.currency === "USD")) {
    expenseByCategory[e.category ?? "Other"] = (expenseByCategory[e.category ?? "Other"] || 0) + parseFloat(e.amount ?? 0);
  }
  const topExpenses = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const financialContext = `
TODAY: ${today.toISOString().slice(0, 10)}
YEAR: ${today.getFullYear()}

=== KEY METRICS (YTD) ===
Total Billed: ${fmt(totalBilled)}
Total Collected: ${fmt(totalCollected)}
Collection Rate: ${totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : 0}%
Outstanding: ${fmt(totalOutstanding)}
Overdue Invoices: ${overdueInvoices.length} invoices = ${fmt(overdueAmount)}
Total Expenses (USD): ${fmt(totalExpenses)}
Gross Margin: ${fmt(totalCollected - totalExpenses)} (collected - expenses)

=== OVERDUE INVOICES ===
${overdueInvoices.slice(0, 15).map((i: any) => {
  const bal = Math.max(0, parseFloat(i.total_amount ?? 0) - parseFloat(i.paid_amount ?? 0));
  const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
  return `- ${i.invoice_ref}: ${i.client_name} | ${fmt(bal)} | ${days}d overdue | Status: ${i.billing_status}`;
}).join("\n")}

=== CLIENT PAYMENT PATTERNS DETECTED ===
${clientPatterns.length > 0 ? clientPatterns.join("\n") : "No unusual patterns detected."}

=== ACTIVE RECURRING TEMPLATES (${(recurring ?? []).length}) ===
${(recurring ?? []).slice(0, 10).map((r: any) => `- ${r.clients?.commercial_name ?? "?"}: ${r.name} | ${fmt(parseFloat(r.amount), r.currency)}/mo | Next: ${r.next_run_date}`).join("\n")}

=== TOP EXPENSE CATEGORIES (YTD USD) ===
${topExpenses.map(([cat, amt]) => `- ${cat}: ${fmt(amt)}`).join("\n")}

=== CLIENTS TOTAL: ${(clients ?? []).length} ===
`;

  const systemPrompt = `You are AXIS, the financial AI agent for Pura Vida Growth (PVG), a marketing agency in Costa Rica.
You have just received a fresh financial data dump. Your job is to produce a structured list of observations — issues, opportunities, and recommendations.

Return ONLY a valid JSON array of observations. No prose, no markdown, just JSON.
Each observation: { type: "issue"|"opportunity"|"info", severity: "high"|"medium"|"low", category: "invoices"|"expenses"|"clients"|"cash_flow"|"recurring"|"payroll", title: string (max 80 chars), detail: string (max 300 chars), related_client: string|null, action_suggested: string|null }

Rules:
- Flag every overdue invoice over $500 as a HIGH issue
- Flag clients who pay twice a month and don't have 2 recurring templates
- Flag chronic late payers
- Surface cash flow risks (high outstanding vs collected)
- Identify opportunities (clients who could be upsold, high margin months)
- Be specific with names and amounts
- Produce 6-15 observations, ordered by severity (high first)`;

  let observations: any[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Analyze this financial data:\n${financialContext}` }],
    });

    const text = (response.content[0] as any).text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      observations = JSON.parse(jsonMatch[0]);
    }
  } catch {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }

  // Save to DB (clear old undismissed ones first, then insert new)
  await db.from("agent_observations").update({ is_dismissed: true }).eq("is_dismissed", false);
  if (observations.length > 0) {
    await db.from("agent_observations").insert(
      observations.map((o: any) => ({
        type: o.type ?? "info",
        severity: o.severity ?? "medium",
        category: o.category ?? "invoices",
        title: String(o.title ?? "").slice(0, 200),
        detail: String(o.detail ?? "").slice(0, 500),
        related_client: o.related_client ?? null,
        action_suggested: o.action_suggested ?? null,
        is_dismissed: false,
      }))
    );
  }

  // Update routine last_run
  await db.from("agent_routines")
    .update({ last_run_at: new Date().toISOString(), last_result: `${observations.length} observations generated` })
    .eq("routine_type", "full_analysis");

  const { data: saved } = await db.from("agent_observations").select("*").eq("is_dismissed", false).order("created_at", { ascending: false });
  return NextResponse.json({ observations: saved ?? [], count: observations.length });
}
