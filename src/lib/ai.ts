import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MonitorAction {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "SEND_FOLLOWUP" | "ESCALATE" | "MARK_DISPUTED" | "SEND_INVOICE" | "VERIFY_PAYMENT" | "ALERT";
  invoiceRef: string;
  invoiceId: number;
  clientName: string;
  reasoning: string;
  suggestedMessage?: string;
}

export interface MonitorReport {
  summary: string;
  actions: MonitorAction[];
  insights: string[];
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  runAt: string;
}

export async function runInvoiceMonitor(invoices: any[]): Promise<MonitorReport> {
  const totalOutstanding = invoices.reduce((s: number, i: any) => s + i.balanceRemaining, 0);
  const totalOverdue = invoices.filter((i: any) => i.daysOverdue > 0).reduce((s: number, i: any) => s + i.balanceRemaining, 0);
  const overdueCount = invoices.filter((i: any) => i.daysOverdue > 0).length;

  const systemPrompt = `You are the PVG Billing AI — expert billing analyst for Pura Vida Growth, a marketing agency in Costa Rica.

PVG billing policy:
- Follow up every 7 days on unpaid invoices
- After 14 days overdue: escalate (urgent tone)
- After 30 days overdue: flag for personal call / dispute
- PROOF_RECEIVED and WAITING_BANK require human bank verification
- DRAFT invoices not yet sent are top priority

Respond ONLY with valid JSON:
{
  "summary": "one paragraph",
  "actions": [{"priority":"HIGH|MEDIUM|LOW","type":"SEND_FOLLOWUP|ESCALATE|MARK_DISPUTED|SEND_INVOICE|VERIFY_PAYMENT|ALERT","invoiceRef":"PVG-YYYY-NNN","invoiceId":123,"clientName":"Name","reasoning":"why","suggestedMessage":"optional"}],
  "insights": ["observation"]
}`;

  const now = new Date().toLocaleDateString("en-US", { timeZone: "America/Costa_Rica", month: "long", day: "numeric", year: "numeric" });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `Today is ${now}. Open invoices:\n\nTotal outstanding: $${totalOutstanding.toLocaleString()}\nTotal overdue: $${totalOverdue.toLocaleString()} (${overdueCount} invoices)\n\n${JSON.stringify(invoices, null, 2)}\n\nAnalyze and return prioritized action plan.`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  let parsed: any = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : text);
  } catch { parsed = { summary: text, actions: [], insights: [] }; }

  return {
    summary: parsed.summary ?? "",
    actions: parsed.actions ?? [],
    insights: parsed.insights ?? [],
    totalOutstanding,
    totalOverdue,
    overdueCount,
    runAt: new Date().toISOString(),
  };
}
