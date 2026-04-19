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

async function buildFinancialContext(): Promise<string> {
  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    { data: invoices },
    { data: expenses },
    { data: recurring },
    { data: payments },
  ] = await Promise.all([
    db.from("invoices").select("id, invoice_ref, client_name, client_email, total_amount, paid_amount, currency, due_date, billing_status, created_at").order("due_date", { ascending: false }).limit(100),
    db.from("expenses").select("amount, date, category, vendor, currency").gte("date", yearStart).limit(200),
    db.from("recurring_invoices").select("name, amount, currency, frequency, next_run_date, is_active, clients(commercial_name)").eq("is_active", true),
    db.from("payments").select("amount, paid_at, method").gte("paid_at", monthStart),
  ]);

  const allInvoices = invoices ?? [];
  const allExpenses = (expenses ?? []).filter((e: any) => e.currency === "USD");
  const overdue = allInvoices.filter((i: any) => {
    if (["PAID", "CANCELLED"].includes(i.billing_status)) return false;
    return i.due_date && new Date(i.due_date) < today;
  });

  const totalBilled = allInvoices.reduce((s: number, i: any) => s + parseFloat(i.total_amount ?? 0), 0);
  const totalCollected = allInvoices.reduce((s: number, i: any) => s + parseFloat(i.paid_amount ?? 0), 0);
  const totalExpenses = allExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount ?? 0), 0);
  const thisMonthPayments = (payments ?? []).reduce((s: number, p: any) => s + parseFloat(p.amount ?? 0), 0);

  const overdueList = overdue.slice(0, 20).map((i: any) => {
    const bal = Math.max(0, parseFloat(i.total_amount ?? 0) - parseFloat(i.paid_amount ?? 0));
    const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
    return `  ${i.invoice_ref} | ${i.client_name} | ${fmt(bal, i.currency)} | ${days}d overdue`;
  }).join("\n");

  const expCats: Record<string, number> = {};
  for (const e of allExpenses) {
    expCats[e.category ?? "Other"] = (expCats[e.category ?? "Other"] || 0) + parseFloat(e.amount ?? 0);
  }
  const expSummary = Object.entries(expCats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `  ${k}: ${fmt(v)}`).join("\n");

  const recurringList = (recurring ?? []).slice(0, 15).map((r: any) =>
    `  ${(r.clients as any)?.commercial_name ?? "?"}: ${r.name} | ${fmt(parseFloat(r.amount), r.currency)}/mo | Next: ${r.next_run_date}`
  ).join("\n");

  return `TODAY: ${today.toISOString().slice(0, 10)}

FINANCIAL SNAPSHOT:
- Total Billed YTD: ${fmt(totalBilled)}
- Collected YTD: ${fmt(totalCollected)} (${totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : 0}%)
- Outstanding: ${fmt(totalBilled - totalCollected)}
- Overdue: ${overdue.length} invoices
- Expenses YTD (USD): ${fmt(totalExpenses)}
- Payments received this month: ${fmt(thisMonthPayments)}

OVERDUE INVOICES (${overdue.length}):
${overdueList || "  None"}

EXPENSE BREAKDOWN:
${expSummary || "  No data"}

ACTIVE RECURRING (${(recurring ?? []).length}):
${recurringList || "  None"}`;
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, conversationId, messages: historyIn } = await req.json();
  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });

  // Build or retrieve conversation history
  let history: Array<{ role: "user" | "assistant"; content: string }> = historyIn ?? [];

  // Get fresh financial context
  const financialContext = await buildFinancialContext();

  const systemPrompt = `You are AXIS, the financial AI agent for Pura Vida Growth (PVG), a boutique marketing agency in Costa Rica led by Federico Rojas. You are embedded in their billing OS and have real-time access to all financial data.

Your personality: Direct, strategic, bilingual (respond in the same language the user writes in). You don't just describe data — you interpret it, flag risks, and recommend actions. You know this business intimately.

What you can do:
- Analyze invoice patterns, client payment behavior, cash flow
- Identify risks and opportunities
- Recommend specific actions (follow-up emails, payment terms adjustments, pricing changes)
- Explain what the numbers mean for the business
- Help think through financial decisions

Current financial data:
${financialContext}

When the user asks about specific clients or invoices, use the data above. Be specific with names and amounts. Keep responses concise — 2-4 paragraphs max unless a detailed analysis is explicitly requested. End with a clear "Next step:" recommendation when relevant.`;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history,
    { role: "user", content: message },
  ];

  let assistantResponse = "";
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    });
    assistantResponse = (response.content[0] as any).text ?? "";
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Agent error" }, { status: 500 });
  }

  // Persist conversation
  const newMessages = [
    ...history,
    { role: "user" as const, content: message },
    { role: "assistant" as const, content: assistantResponse },
  ];

  let convId = conversationId;
  if (convId) {
    await db.from("agent_conversations").update({
      messages: newMessages,
      updated_at: new Date().toISOString(),
    }).eq("id", convId);
  } else {
    const title = message.slice(0, 60);
    const { data: conv } = await db.from("agent_conversations").insert({
      messages: newMessages,
      title,
    }).select().single();
    convId = (conv as any)?.id;
  }

  return NextResponse.json({
    response: assistantResponse,
    conversationId: convId,
    messages: newMessages,
  });
}

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await db.from("agent_conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  return NextResponse.json(data ?? []);
}
