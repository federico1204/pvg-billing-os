import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

let _ai: Anthropic | null = null;
function getAI() {
  if (!_ai) _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: client, error: clientError } = await db
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (clientError || !client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: invoices } = await db
    .from("invoices")
    .select("*")
    .eq("client_email", (client as any).email)
    .order("created_at", { ascending: false });

  const { data: entities } = await db
    .from("client_entities")
    .select("*")
    .eq("client_id", id);

  const clientInvoices = invoices ?? [];
  const clientEntities = entities ?? [];

  const totalBilled = clientInvoices.reduce((s: number, i: any) => s + parseFloat(i.total_amount ?? 0), 0);
  const totalPaid = clientInvoices.reduce((s: number, i: any) => s + parseFloat(i.paid_amount ?? 0), 0);
  const outstanding = totalBilled - totalPaid;
  const paidCount = clientInvoices.filter((i: any) => parseFloat(i.paid_amount ?? 0) >= parseFloat(i.total_amount ?? 0)).length;
  const unpaidCount = clientInvoices.length - paidCount;

  const today = new Date();
  const overdueInvoices = clientInvoices.filter((i: any) => {
    if (!i.due_date) return false;
    const due = new Date(i.due_date);
    return due < today && parseFloat(i.paid_amount ?? 0) < parseFloat(i.total_amount ?? 0);
  });

  const entitySummary = clientEntities.length > 0
    ? clientEntities.map((e: any) =>
        `${e.entity_name} (${e.entity_type}${e.billing_split_percentage ? `, ${e.billing_split_percentage}%` : ""})`
      ).join("; ")
    : "No payment entities defined";

  const prompt = `You are a billing analyst for a digital services agency. Analyze this client and provide actionable insights.

CLIENT PROFILE:
- Name: ${(client as any).commercial_name || (client as any).name}
- LLC/Legal Name: ${(client as any).llc_name || "N/A"}
- Country: ${(client as any).country || "Unknown"}
- Preferred Language: ${(client as any).preferred_language === "es" ? "Spanish" : "English"}
- Payment Pattern / Billing Notes: ${(client as any).billing_notes || (client as any).payment_pattern || "Not specified"}
- Notes: ${(client as any).notes || "None"}

FINANCIAL SUMMARY:
- Total Billed: $${totalBilled.toFixed(2)}
- Total Paid: $${totalPaid.toFixed(2)}
- Outstanding Balance: $${outstanding.toFixed(2)}
- Total Invoices: ${clientInvoices.length}
- Paid Invoices: ${paidCount}
- Unpaid Invoices: ${unpaidCount}
- Overdue Invoices: ${overdueInvoices.length}${overdueInvoices.length > 0 ? ` (${overdueInvoices.map((i: any) => `${i.invoice_ref || i.id} - $${(parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0)).toFixed(2)} overdue`).join(", ")})` : ""}

PAYMENT ENTITIES (who pays / receives invoices):
${entitySummary}

Based on this data, respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "relationship_summary": "2-3 sentences on this client's payment behavior and relationship",
  "recommendations": [
    { "type": "follow_up|upsell|retention|pricing|risk", "title": "short title", "detail": "specific action to take" }
  ],
  "payment_reliability": "excellent|good|fair|poor",
  "next_action": "single most important thing to do with this client right now"
}

Include 2-4 recommendations. Types must be one of: follow_up, upsell, retention, pricing, risk.`;

  try {
    const ai = getAI();
    const message = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as any).text as string;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const insights = JSON.parse(jsonMatch[0]);
    return NextResponse.json(insights);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI error" }, { status: 500 });
  }
}
