import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listFolderFiles, downloadFileAsBuffer, exportGoogleDocAsPDF } from "@/lib/gdrive";
import { nextInvoiceRef } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

let _ai: Anthropic | null = null;
function getAI() {
  if (!_ai) _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}

const EXTRACT_PROMPT = `You are extracting invoice/billing data from a document. Return ONLY a JSON object with these fields (use null for missing):
{
  "invoiceRef": string or null,         // invoice/credit note number e.g. "INV-2025-001" or "CN-001"
  "clientCommercialName": string or null, // the brand/trade name the client goes by (e.g. "Nacho's Restaurant")
  "clientLLCName": string or null,      // the legal entity / LLC name (e.g. "Restaurant Group CR LLC")
  "clientName": string or null,         // fallback if can't distinguish — use commercial name
  "clientEmail": string or null,
  "clientCompany": string or null,
  "projectName": string or null,
  "totalAmount": number or null,        // final total amount (after tax/discounts)
  "currency": "USD" | "CRC" | "EUR",   // default USD
  "invoiceType": "standard" | "cr_iva" | "credit_note",
  "dueDate": string or null,            // ISO date YYYY-MM-DD
  "invoiceDate": string or null,        // ISO date YYYY-MM-DD
  "sinpeNumber": string or null,
  "notes": string or null,
  "preferredLanguage": "en" | "es",     // detect from document language
  "lineItems": [{ "description": string, "category": string, "quantity": number, "rate": number, "amount": number }]
}

Respond with ONLY the JSON, no markdown, no explanation.`;

async function extractFromPDF(pdfBuffer: Buffer, filename: string): Promise<any> {
  const base64 = pdfBuffer.toString("base64");
  const ai = getAI();

  try {
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            } as any,
            { type: "text", text: `Filename: ${filename}\n\n${EXTRACT_PROMPT}` },
          ],
        },
      ],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const files = await listFolderFiles(FOLDER_ID);
    return NextResponse.json(files);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileIds } = body as { fileIds: string[] };

  const files = await listFolderFiles(FOLDER_ID);
  const fileMap = Object.fromEntries(files.map((f) => [f.id, f]));

  const results: any[] = [];

  for (const fileId of fileIds) {
    const file = fileMap[fileId];
    if (!file) { results.push({ fileId, status: "not_found" }); continue; }

    try {
      let pdfBuffer: Buffer;
      if (file.mimeType === "application/pdf") {
        pdfBuffer = await downloadFileAsBuffer(fileId);
      } else if (file.mimeType.startsWith("application/vnd.google-apps.")) {
        pdfBuffer = await exportGoogleDocAsPDF(fileId);
      } else {
        results.push({ fileId, name: file.name, status: "skipped", reason: "unsupported type" });
        continue;
      }

      const extracted = await extractFromPDF(pdfBuffer, file.name);
      if (!extracted) {
        results.push({ fileId, name: file.name, status: "failed", reason: "extraction failed" });
        continue;
      }

      // Check for duplicate by invoiceRef
      if (extracted.invoiceRef) {
        const { data: existing } = await db
          .from("invoices")
          .select("id, invoice_ref")
          .eq("invoice_ref", extracted.invoiceRef)
          .single();
        if (existing) {
          results.push({ fileId, name: file.name, status: "duplicate", invoiceRef: extracted.invoiceRef, existingId: (existing as any).id });
          continue;
        }
      }

      // Generate invoice ref if not found
      const { data: last } = await db.from("invoices").select("invoice_ref").order("id", { ascending: false }).limit(1);
      const invoiceRef = extracted.invoiceRef || nextInvoiceRef(last?.[0]?.invoice_ref);

      const commercialName = extracted.clientCommercialName || extracted.clientName || file.name.replace(/\.[^.]+$/, "");
      const llcName = extracted.clientLLCName;

      const { data: created, error } = await db.from("invoices").insert({
        invoice_ref: invoiceRef,
        client_name: commercialName,
        client_commercial_name: commercialName,
        client_llc_name: llcName,
        client_email: extracted.clientEmail,
        client_company: extracted.clientCompany || llcName || commercialName,
        project_name: extracted.projectName,
        total_amount: extracted.totalAmount || 0,
        paid_amount: 0,
        currency: extracted.currency || "USD",
        invoice_type: extracted.invoiceType || "standard",
        due_date: extracted.dueDate || new Date().toISOString().split("T")[0],
        invoice_date: extracted.invoiceDate || new Date().toISOString().split("T")[0],
        sinpe_number: extracted.sinpeNumber,
        notes: extracted.notes,
        line_items: extracted.lineItems || [],
        preferred_language: extracted.preferredLanguage || "en",
        billing_status: "DRAFT",
        status: "pending",
      }).select().single();

      if (error) {
        results.push({ fileId, name: file.name, status: "error", reason: error.message });
        continue;
      }

      await db.from("billing_activity").insert({
        invoice_id: (created as any).id,
        action: "imported",
        description: `Imported from Google Drive: ${file.name}`,
        performed_by: "drive_import",
      });

      results.push({ fileId, name: file.name, status: "imported", invoiceRef, id: (created as any).id, extracted });
    } catch (err: any) {
      results.push({ fileId, name: file.name, status: "error", reason: err.message });
    }
  }

  return NextResponse.json({ results });
}
