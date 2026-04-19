/**
 * PVG Billing OS — Google Drive Bulk Import
 * Reads all JRC invoices/credit notes and PVG bank statements from Drive,
 * extracts data with Claude, and inserts into Supabase.
 */

import { readFileSync } from "fs";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

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

// --- Helpers ---
async function listFiles(folderId) {
  const r = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,createdTime)",
    pageSize: 200,
    orderBy: "name",
  });
  return r.data.files ?? [];
}

async function downloadBuffer(fileId) {
  const r = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(r.data);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// --- Extract invoice from PDF ---
async function extractInvoicePDF(buffer, filename) {
  const b64 = buffer.toString("base64");
  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
        { type: "text", text: `File: ${filename}
Extract ALL data from this Costa Rica electronic invoice or credit note. Return ONLY JSON:
{
  "emisor_nombre": string,
  "emisor_cedula": string,
  "receptor_nombre": string,
  "receptor_cedula": string | null,
  "receptor_email": string | null,
  "numero_factura": string,
  "fecha_emision": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD" | null,
  "moneda": "USD" | "CRC",
  "subtotal": number,
  "impuesto_total": number,
  "total": number,
  "tipo_documento": "factura" | "nota_credito" | "tiquete",
  "lineas": [{"descripcion": string, "cantidad": number, "precio_unitario": number, "subtotal": number}]
}` }
      ]
    }]
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean);
}

// --- Get or create client ---
async function upsertClient(nombre, cedula, email) {
  const { data: existing } = await db.from("clients").select("id").eq("llc_name", nombre).single();
  if (existing) return existing.id;

  // Also check by email
  if (email) {
    const { data: byEmail } = await db.from("clients").select("id").eq("email", email).single();
    if (byEmail) return byEmail.id;
  }

  const { data: created } = await db.from("clients").insert({
    name: nombre,
    commercial_name: nombre,
    llc_name: nombre,
    email: email || null,
    country: "Costa Rica",
    preferred_language: "es",
  }).select("id").single();
  return created?.id ?? null;
}

// --- Process all JRC invoices ---
async function importJRCInvoices() {
  console.log("\n=== IMPORTING JRC INVOICES ===");

  const jrcFolder = (await listFiles(ROOT_FOLDER)).find(f => f.name === "JRC");
  if (!jrcFolder) { console.log("JRC folder not found"); return; }

  const jrcContents = await listFiles(jrcFolder.id);
  const factFolder = jrcContents.find(f => f.name.includes("Facturas") || f.name.includes("factura"));
  const ncFolder = jrcContents.find(f => f.name.includes("Nota") || f.name.includes("Crédito") || f.name.includes("Credito"));

  const pdfFiles = [];

  // Collect from Facturas subfolders
  if (factFolder) {
    const subFolders = await listFiles(factFolder.id);
    for (const sub of subFolders) {
      if (sub.mimeType === "application/vnd.google-apps.folder") {
        const files = await listFiles(sub.id);
        for (const f of files) if (f.mimeType === "application/pdf") pdfFiles.push({ ...f, folder: "factura" });
      }
    }
  }

  // Collect from Notas de Crédito subfolders
  if (ncFolder) {
    const subFolders = await listFiles(ncFolder.id);
    for (const sub of subFolders) {
      if (sub.mimeType === "application/vnd.google-apps.folder") {
        const files = await listFiles(sub.id);
        for (const f of files) if (f.mimeType === "application/pdf") pdfFiles.push({ ...f, folder: "nota_credito" });
      } else if (sub.mimeType === "application/pdf") {
        pdfFiles.push({ ...sub, folder: "nota_credito" });
      }
    }
  }

  console.log(`Found ${pdfFiles.length} PDF files to process`);

  let imported = 0, skipped = 0, errors = 0;

  for (let i = 0; i < pdfFiles.length; i++) {
    const file = pdfFiles[i];
    process.stdout.write(`[${i + 1}/${pdfFiles.length}] ${file.name} ... `);

    try {
      const buf = await downloadBuffer(file.id);
      const data = await extractInvoicePDF(buf, file.name);

      const invoiceRef = `CR-${data.numero_factura}`;
      const invoiceType = (data.tipo_documento === "nota_credito" || file.folder === "nota_credito") ? "credit_note" : "cr_iva";

      // Check duplicate
      const { data: existing } = await db.from("invoices").select("id").eq("invoice_ref", invoiceRef).single();
      if (existing) { console.log("SKIP (exists)"); skipped++; continue; }

      // Upsert client
      await upsertClient(data.receptor_nombre, data.receptor_cedula, data.receptor_email);

      // Create invoice
      const lineItems = (data.lineas ?? []).map(l => ({
        description: l.descripcion,
        category: "Monthly Retainer",
        quantity: l.cantidad,
        rate: l.precio_unitario,
        amount: l.subtotal,
      }));

      await db.from("invoices").insert({
        invoice_ref: invoiceRef,
        client_name: data.receptor_nombre,
        client_commercial_name: data.receptor_nombre,
        client_llc_name: data.receptor_nombre,
        client_email: data.receptor_email,
        client_company: data.receptor_nombre,
        project_name: data.lineas?.[0]?.descripcion ?? null,
        total_amount: data.total,
        paid_amount: 0,
        currency: data.moneda ?? "USD",
        invoice_type: invoiceType,
        invoice_date: data.fecha_emision,
        due_date: data.fecha_vencimiento ?? data.fecha_emision,
        billing_status: "SENT",
        status: "pending",
        preferred_language: "es",
        line_items: lineItems,
        notes: `Factura electrónica CR. Subtotal: ${data.moneda === "CRC" ? "₡" : "$"}${data.subtotal} + IVA ${data.moneda === "CRC" ? "₡" : "$"}${data.impuesto_total}`,
      });

      await db.from("billing_activity").insert({
        action: "imported",
        description: `Imported from Drive: ${file.name} (${data.receptor_nombre})`,
        performed_by: "drive_import",
      });

      console.log(`OK — ${data.receptor_nombre} ${data.moneda} ${data.total}`);
      imported++;
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      errors++;
    }

    // Rate limit: pause every 5 requests
    if ((i + 1) % 5 === 0) await sleep(2000);
  }

  console.log(`\nJRC: ${imported} imported, ${skipped} skipped, ${errors} errors`);
}

// --- Process PVG Bank Statements (Excel) ---
async function importBankStatements() {
  console.log("\n=== IMPORTING PVG BANK STATEMENTS ===");

  const pvgFolder = (await listFiles(ROOT_FOLDER)).find(f => f.name === "PVG");
  if (!pvgFolder) { console.log("PVG folder not found"); return; }

  const pvgContents = await listFiles(pvgFolder.id);
  const bankFolder = pvgContents.find(f => f.name.includes("Bank"));
  if (!bankFolder) { console.log("Bank Statements folder not found"); return; }

  const bankFiles = (await listFiles(bankFolder.id)).filter(f =>
    f.mimeType.includes("excel") || f.mimeType.includes("spreadsheet") || f.name.endsWith(".xls") || f.name.endsWith(".xlsx")
  );

  console.log(`Found ${bankFiles.length} bank statement files`);

  // Download and ask Claude to extract transactions
  let totalExpenses = 0;

  for (const file of bankFiles) {
    console.log(`\nProcessing: ${file.name}`);

    try {
      const buf = await downloadBuffer(file.id);
      const b64 = buf.toString("base64");

      // Use Claude to read the Excel data
      const msg = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/vnd.ms-excel", data: b64 } },
            { type: "text", text: `This is a bank statement Excel file for Pura Vida Growth. Extract ALL transactions as JSON array:
[{
  "fecha": "YYYY-MM-DD",
  "descripcion": string,
  "monto": number (positive=income, negative=expense),
  "moneda": "USD" | "CRC",
  "tipo": "ingreso" | "gasto",
  "categoria_sugerida": string (e.g. "Software & Subscriptions", "Advertising & Marketing", "Professional Services", "Contractors & Freelancers", "Other")
}]
Return ONLY the JSON array. Include all rows.` }
          ]
        }]
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const transactions = JSON.parse(clean);

      console.log(`  Found ${transactions.length} transactions`);

      // Insert expenses (negative transactions = outflows)
      const expenses = transactions.filter(t => t.tipo === "gasto" || t.monto < 0);
      for (const t of expenses) {
        const amount = Math.abs(t.monto);
        if (amount < 0.01) continue;

        // Check if already exists (by date + description + amount)
        const { data: existing } = await db.from("expenses")
          .select("id")
          .eq("date", t.fecha)
          .eq("amount", amount)
          .ilike("description", t.descripcion.substring(0, 30) + "%")
          .single();

        if (!existing) {
          await db.from("expenses").insert({
            date: t.fecha,
            description: t.descripcion,
            amount,
            currency: t.moneda ?? "USD",
            category: t.categoria_sugerida ?? "Other",
            vendor: t.descripcion,
            notes: `From bank statement: ${file.name}`,
          });
          totalExpenses++;
        }
      }

      // Log income transactions as potential payment matches
      const income = transactions.filter(t => t.tipo === "ingreso" || t.monto > 0);
      console.log(`  ${expenses.length} expenses, ${income.length} income entries`);

    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }

    await sleep(2000);
  }

  console.log(`\nBank statements: ${totalExpenses} expenses imported`);
}

// --- Main ---
async function main() {
  console.log("PVG Billing OS — Drive Import");
  console.log("Supabase:", process.env.NEXT_PUBLIC_SUPABASE_URL);

  await importJRCInvoices();
  await importBankStatements();

  console.log("\n✓ Import complete");
}

main().catch(console.error);
