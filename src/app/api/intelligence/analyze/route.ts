import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// Lazy Anthropic client
let _ai: Anthropic | null = null;
function getAI() {
  if (!_ai) _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}

export async function POST(_req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // Parallel data fetches
  const [
    { data: openInvoices },
    { data: recentlyPaid },
    { data: expenses },
    { data: clients },
    { data: overdueInvoices },
  ] = await Promise.all([
    db.from("invoices")
      .select("client_name, total_amount, paid_amount, due_date, billing_status, updated_at, currency")
      .not("billing_status", "in", '("PAID","CANCELLED")'),
    db.from("invoices")
      .select("paid_amount, updated_at, billing_status")
      .eq("billing_status", "PAID")
      .gte("updated_at", ninetyDaysAgo),
    db.from("expenses")
      .select("amount, date, category, description")
      .gte("date", monthStart.split("T")[0]),
    db.from("clients")
      .select("name, company, status"),
    db.from("invoices")
      .select("client_name, total_amount, paid_amount, due_date, billing_status")
      .lt("due_date", todayISO)
      .in("billing_status", ["OVERDUE", "SENT"]),
  ]);

  // Calculate metrics
  const openList = openInvoices ?? [];
  const paidList = recentlyPaid ?? [];
  const expenseList = expenses ?? [];
  const clientList = clients ?? [];
  const overdueList = (overdueInvoices ?? []).filter(
    (i: any) => i.billing_status === "OVERDUE" || i.billing_status === "SENT"
  );

  const totalOutstanding = openList.reduce((s: number, i: any) => {
    return s + Math.max(0, parseFloat(i.total_amount ?? "0") - parseFloat(i.paid_amount ?? "0"));
  }, 0);

  const totalOverdue = overdueList.reduce((s: number, i: any) => {
    return s + Math.max(0, parseFloat(i.total_amount ?? "0") - parseFloat(i.paid_amount ?? "0"));
  }, 0);

  const collectedThisMonth = paidList
    .filter((i: any) => i.updated_at && new Date(i.updated_at) >= new Date(monthStart))
    .reduce((s: number, i: any) => s + parseFloat(i.paid_amount ?? "0"), 0);

  const expensesThisMonth = expenseList.reduce((s: number, e: any) => s + parseFloat(e.amount ?? "0"), 0);
  const netThisMonth = collectedThisMonth - expensesThisMonth;

  // Build prompt data
  const metrics = {
    totalOutstanding: totalOutstanding.toFixed(2),
    totalOverdue: totalOverdue.toFixed(2),
    collectedThisMonth: collectedThisMonth.toFixed(2),
    expensesThisMonth: expensesThisMonth.toFixed(2),
    netThisMonth: netThisMonth.toFixed(2),
    openInvoiceCount: openList.length,
    overdueInvoiceCount: overdueList.length,
    clientCount: clientList.length,
  };

  const systemPrompt = `You are the Chief Financial Officer and strategic advisor for Pura Vida Growth, a marketing agency in Costa Rica run by Federico Rojas. You speak directly to Federico as a trusted advisor. Be specific, direct, and actionable. Never be vague. If something needs attention, say exactly what and why.

Respond ONLY with valid JSON in exactly this structure:
{
  "health_score": 0-100,
  "health_label": "Healthy|Caution|At Risk|Critical",
  "executive_summary": "2-3 sentences",
  "top_3_actions": [
    {
      "priority": 1,
      "action": "specific action to take",
      "why": "reason",
      "potential_impact": "dollar amount or outcome",
      "do_this": "exact step to do right now"
    }
  ],
  "cash_flow_forecast": {
    "next_30_days_in": 0,
    "next_30_days_out": 0,
    "next_30_days_net": 0,
    "commentary": "explanation"
  },
  "revenue_opportunities": [
    {
      "client": "client name",
      "opportunity": "what to do",
      "approach": "how to approach",
      "estimated_value": "$X"
    }
  ],
  "risk_flags": [
    {
      "type": "risk type",
      "client": "client name or null",
      "description": "specific description",
      "urgency": "high|medium|low"
    }
  ],
  "pricing_insights": [
    "specific insight about pricing"
  ],
  "expense_insights": [
    "specific insight about expenses"
  ],
  "this_week_priorities": [
    "priority 1",
    "priority 2",
    "priority 3"
  ]
}`;

  const now = new Date().toLocaleDateString("en-US", { timeZone: "America/Costa_Rica", month: "long", day: "numeric", year: "numeric" });

  const userMessage = `Today is ${now}. Here is the full financial picture for Pura Vida Growth:

## Key Metrics
- Total Outstanding (unpaid invoices): $${metrics.totalOutstanding}
- Total Overdue: $${metrics.totalOverdue} (${metrics.overdueInvoiceCount} invoices)
- Collected This Month: $${metrics.collectedThisMonth}
- Expenses This Month: $${metrics.expensesThisMonth}
- Net Cash Position This Month: $${metrics.netThisMonth}
- Open Invoices: ${metrics.openInvoiceCount}
- Active Clients: ${metrics.clientCount}

## Open Invoices (not paid or cancelled)
${JSON.stringify(openList.map((i: any) => ({
  client: i.client_name,
  total: parseFloat(i.total_amount ?? "0"),
  paid: parseFloat(i.paid_amount ?? "0"),
  balance: Math.max(0, parseFloat(i.total_amount ?? "0") - parseFloat(i.paid_amount ?? "0")),
  due: i.due_date,
  status: i.billing_status,
})), null, 2)}

## Overdue Invoices
${JSON.stringify(overdueList.map((i: any) => ({
  client: i.client_name,
  balance: Math.max(0, parseFloat(i.total_amount ?? "0") - parseFloat(i.paid_amount ?? "0")),
  due: i.due_date,
  status: i.billing_status,
})), null, 2)}

## This Month's Expenses
${JSON.stringify(expenseList.map((e: any) => ({
  amount: parseFloat(e.amount ?? "0"),
  category: e.category,
  description: e.description,
  date: e.date,
})), null, 2)}

## Clients
${JSON.stringify(clientList.map((c: any) => ({ name: c.name, company: c.company, status: c.status })), null, 2)}

Analyze this data and provide your full financial intelligence report as CFO.`;

  const ai = getAI();
  const response = await ai.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  let report: any = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    report = JSON.parse(match ? match[0] : text);
  } catch {
    report = {
      health_score: 50,
      health_label: "Caution",
      executive_summary: text.slice(0, 300),
      top_3_actions: [],
      cash_flow_forecast: { next_30_days_in: 0, next_30_days_out: 0, next_30_days_net: 0, commentary: "" },
      revenue_opportunities: [],
      risk_flags: [],
      pricing_insights: [],
      expense_insights: [],
      this_week_priorities: [],
    };
  }

  // Upsert snapshot
  await db.from("financial_snapshots").upsert({
    snapshot_date: todayISO,
    total_outstanding_usd: parseFloat(metrics.totalOutstanding),
    total_overdue_usd: parseFloat(metrics.totalOverdue),
    collected_this_month_usd: collectedThisMonth,
    total_expenses_this_month_usd: expensesThisMonth,
    net_cash_position_usd: netThisMonth,
    open_invoice_count: openList.length,
    overdue_invoice_count: overdueList.length,
    report_json: report,
  }, { onConflict: "snapshot_date" });

  return NextResponse.json(report);
}
