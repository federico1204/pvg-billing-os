/**
 * PVG Bank Statement Import
 * BAC Costa Rica format: header at row 12, cols: Fecha(0), Ref(1), Código(3), Descripción(4), Débitos(7), Créditos(8)
 * Currency from row 6 col 5 (e.g. "USD")
 */

import { readFileSync } from "fs";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

// --- Load env ---
readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
});

const DRIVE_CREDS = JSON.parse(readFileSync("/Users/fedepvg/Downloads/pvg-mission-control-41a951d09c6e.json", "utf8"));
const ROOT_FOLDER = "1AfAEaAjHYvzjaLTeG5jii0OrW2eVyLbD";

const auth = new google.auth.GoogleAuth({ credentials: DRIVE_CREDS, scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
const drive = google.drive({ version: "v3", auth });
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function listFiles(folderId) {
  const r = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)", pageSize: 200,
  });
  return r.data.files ?? [];
}

async function downloadBuffer(fileId) {
  const r = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(r.data);
}

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().split("T")[0];
  if (typeof raw === "string") {
    // DD/MM/YYYY
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
  }
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  return null;
}

// Use Claude to categorize a batch of transactions
async function categorizeBatch(transactions) {
  const list = transactions.map((t, i) => `${i}. ${t.descripcion} | ${t.tipo} | ${t.monto}`).join("\n");
  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Categorize these Costa Rica bank transactions for a marketing agency (Pura Vida Growth).
For each, return the best expense category from this list:
- Advertising & Marketing
- Contractors & Freelancers
- Software & Subscriptions
- Office Supplies
- Professional Services
- Travel & Transportation
- Meals & Entertainment
- Equipment & Hardware
- Rent & Utilities
- Insurance
- Taxes & Licenses
- Payroll & Salaries
- Bank Fees
- Client Payment (for income/credits from clients)
- Other

Transactions:
${list}

Return ONLY a JSON array of categories (one per line, same order): ["Category", "Category", ...]`
    }]
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(clean); } catch { return transactions.map(() => "Other"); }
}

async function parseBACStatement(buf, filename) {
  const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Currency from row 6 col 5
  const currencyRaw = String(rows[6]?.[5] ?? "").trim().toUpperCase();
  const currency = currencyRaw === "CRC" || currencyRaw.includes("COLONES") ? "CRC" : "USD";

  // Header is at row 12 (index), data starts row 13
  // Cols: Fecha(0), Referencia(1), Código(3), Descripción(4), Débitos(7), Créditos(8)
  const transactions = [];

  for (let i = 13; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[0];
    const desc = String(row[4] ?? "").trim();
    const debit = parseFloat(String(row[7]).replace(/[^0-9.\-]/g, "")) || 0;
    const credit = parseFloat(String(row[8]).replace(/[^0-9.\-]/g, "")) || 0;

    if (!rawDate || !desc) continue;
    const date = parseDate(rawDate);
    if (!date) continue;

    // Skip rows that are just balance summaries (no debit or credit > 0)
    if (debit === 0 && credit === 0) continue;

    if (debit > 0) {
      transactions.push({ date, descripcion: desc, monto: -debit, tipo: "gasto", currency });
    }
    if (credit > 0) {
      transactions.push({ date, descripcion: desc, monto: credit, tipo: "ingreso", currency });
    }
  }

  return transactions;
}

async function main() {
  console.log("PVG Bank Statement Import (BAC format)");

  const pvgFolder = (await listFiles(ROOT_FOLDER)).find(f => f.name === "PVG");
  if (!pvgFolder) { console.log("PVG folder not found"); return; }

  const pvgContents = await listFiles(pvgFolder.id);
  const bankFolder = pvgContents.find(f => f.name.includes("Bank"));
  if (!bankFolder) { console.log("Bank folder not found"); return; }

  const bankFiles = await listFiles(bankFolder.id);
  console.log(`Found ${bankFiles.length} bank statement files\n`);

  let totalImported = 0;
  let totalIncome = 0;
  let totalSkipped = 0;

  for (const file of bankFiles) {
    console.log(`Processing: ${file.name}`);
    const buf = await downloadBuffer(file.id);

    const transactions = await parseBACStatement(buf, file.name);
    const expenses = transactions.filter(t => t.tipo === "gasto");
    const income = transactions.filter(t => t.tipo === "ingreso");
    console.log(`  Parsed: ${expenses.length} debits, ${income.length} credits`);

    if (transactions.length === 0) continue;

    // Categorize all in batches of 20
    const BATCH = 20;
    let imported = 0, skipped = 0;

    for (let i = 0; i < transactions.length; i += BATCH) {
      const batch = transactions.slice(i, i + BATCH);
      let categories;
      try {
        categories = await categorizeBatch(batch);
      } catch {
        categories = batch.map(() => "Other");
      }

      for (let j = 0; j < batch.length; j++) {
        const t = batch[j];
        const category = categories[j] ?? "Other";
        const amount = Math.abs(t.monto);

        const { data: existing } = await db.from("expenses")
          .select("id")
          .eq("date", t.date)
          .eq("amount", amount)
          .ilike("description", t.descripcion.substring(0, 20) + "%")
          .maybeSingle();

        if (!existing) {
          await db.from("expenses").insert({
            date: t.date,
            description: t.descripcion,
            amount,
            currency: t.currency,
            category,
            vendor: t.descripcion,
            notes: `${t.tipo === "gasto" ? "Gasto" : "Ingreso"} · ${file.name}`,
          });
          imported++;
        } else {
          skipped++;
        }
      }

      await sleep(800);
    }

    console.log(`  Imported ${imported}, skipped ${skipped} duplicates`);
    totalImported += imported;
    totalSkipped += skipped;
    totalIncome += income.length;
  }

  console.log(`\n✓ Bank statements complete:`);
  console.log(`  ${totalImported} transactions imported`);
  console.log(`  ${totalSkipped} duplicates skipped`);
  console.log(`  ${totalIncome} income entries (client payments visible in expenses table)`);
}

main().catch(console.error);
