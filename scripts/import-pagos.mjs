/**
 * PVG Pagos Import
 * Reads local PDFs from /Users/fedepvg/Documents/A-PVG/Pagos,
 * extracts expense data with Claude Haiku, inserts into Supabase expenses table.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Load env
readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
});

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const PAGOS_ROOT = "/Users/fedepvg/Documents/A-PVG/Pagos";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Recursively find all PDFs
function findPDFs(dir, results = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findPDFs(fullPath, results);
    } else if (extname(entry).toLowerCase() === ".pdf") {
      results.push(fullPath);
    }
  }
  return results;
}

// Infer category from folder path
function inferCategory(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes("/team/") || lower.includes("pago diana") || lower.includes("pago alexandra") || lower.includes("pago jose") || lower.includes("pago emanuel")) return "Payroll & Salaries";
  if (lower.includes("/conta/") || lower.includes("contabilidad")) return "Professional Services";
  if (lower.includes("/oficina/") || lower.includes("oficina")) return "Rent & Utilities";
  if (lower.includes("/celulares/")) return "Rent & Utilities";
  if (lower.includes("/tarjetas/") || lower.includes("banca en línea")) return "Bank Fees";
  if (lower.includes("/wedigital/")) return "Software & Subscriptions";
  if (lower.includes("/diseño/") || lower.includes("branding")) return "Advertising & Marketing";
  if (lower.includes("/legal/")) return "Professional Services";
  if (lower.includes("/loan/")) return "Bank Fees";
  if (lower.includes("impuestos")) return "Taxes & Licenses";
  if (lower.includes("amazon")) return "Office Supplies";
  if (lower.includes("liberty") || lower.includes("movistar")) return "Rent & Utilities";
  return "Other";
}

async function extractFromPDF(filePath) {
  const buf = readFileSync(filePath);
  const b64 = buf.toString("base64");
  const fileName = filePath.split("/").pop();
  const suggestedCategory = inferCategory(filePath);

  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b64 }
        },
        {
          type: "text",
          text: `This is an expense receipt or payment document for Pura Vida Growth (a Costa Rica marketing agency).
File: ${fileName}
Suggested category: ${suggestedCategory}

Extract the expense details. Return ONLY valid JSON:
{
  "date": "YYYY-MM-DD or null if not found",
  "vendor": "who received the payment",
  "description": "what was paid for (short, specific)",
  "amount": number (the total amount paid),
  "currency": "USD" or "CRC",
  "category": "${suggestedCategory}",
  "notes": "any relevant detail (person name, period, service type)"
}

If you cannot determine a value, use null. For amount, extract the most relevant total.`
        }
      ]
    }]
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean);
}

async function main() {
  console.log("PVG Pagos Import\n");

  const pdfs = findPDFs(PAGOS_ROOT);
  console.log(`Found ${pdfs.length} PDFs\n`);

  let imported = 0, skipped = 0, errors = 0;

  for (let i = 0; i < pdfs.length; i++) {
    const filePath = pdfs[i];
    const shortPath = filePath.replace(PAGOS_ROOT, "");
    process.stdout.write(`[${i + 1}/${pdfs.length}] ${shortPath} ... `);

    try {
      const data = await extractFromPDF(filePath);

      if (!data.amount || data.amount <= 0) {
        console.log("SKIP (no amount extracted)");
        skipped++;
        continue;
      }

      const date = data.date ?? new Date().toISOString().split("T")[0];

      // Check duplicate by file path in notes
      const { data: existing } = await db.from("expenses")
        .select("id")
        .like("notes", `%${shortPath}%`)
        .maybeSingle();

      if (existing) {
        console.log("SKIP (already imported)");
        skipped++;
        continue;
      }

      await db.from("expenses").insert({
        date,
        description: data.description || filePath.split("/").pop()?.replace(".pdf", ""),
        amount: Math.abs(data.amount),
        currency: data.currency ?? "USD",
        category: data.category ?? "Other",
        vendor: data.vendor,
        notes: `Pagos: ${shortPath}${data.notes ? " · " + data.notes : ""}`,
      });

      console.log(`OK — ${data.vendor} ${data.currency} ${data.amount} (${data.category})`);
      imported++;
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      errors++;
    }

    // Rate limit pause every 5 requests
    if ((i + 1) % 5 === 0) await sleep(1500);
  }

  console.log(`\n✓ Pagos import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
}

main().catch(console.error);
