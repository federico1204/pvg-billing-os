import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

let _ai: Anthropic | null = null;
function getAI() {
  if (!_ai) _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}

const PURPOSE_LABELS: Record<string, string> = {
  follow_up: "follow-up on an outstanding invoice or pending balance",
  invoice_intro: "introduce and send a new invoice",
  payment_thanks: "thank the client for a recent payment",
  check_in: "check in and maintain the relationship",
  upsell: "propose an additional service or upsell opportunity",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { purpose, invoiceRef } = body as { purpose: string; invoiceRef?: string };

  if (!purpose) return NextResponse.json({ error: "purpose is required" }, { status: 400 });

  const { data: client, error: clientError } = await db
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (clientError || !client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lang = (client as any).preferred_language === "es" ? "es" : "en";
  const clientName = (client as any).commercial_name || (client as any).name;
  const purposeDesc = PURPOSE_LABELS[purpose] || purpose;

  const langInstruction =
    lang === "es"
      ? "Write the email entirely in Spanish (Latin American Spanish, professional but warm)."
      : "Write the email in English (professional but warm).";

  const invoiceNote = invoiceRef ? `\nReference invoice: ${invoiceRef}` : "";

  const prompt = `You are writing a professional client email for a digital services agency called Pura Vida Growth.

Client name: ${clientName}
Email purpose: ${purposeDesc}${invoiceNote}
${langInstruction}

Write a short, professional email for this purpose. Include [SIGNATURE] as a placeholder at the end for the sender's signature.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "subject": "email subject line",
  "body": "full email body with greeting, content, and [SIGNATURE] at the end"
}`;

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

    const draft = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ...draft, lang });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI error" }, { status: 500 });
  }
}
