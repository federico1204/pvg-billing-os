/**
 * PVG CRC Bank Statement Import
 * Imports BAC Costa Rica CRC (Colones) statements from local XLS files.
 * Applies rule-based categorization for known CRC-specific patterns.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
});

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const FILES = [
  "/Users/fedepvg/Downloads/Transacciones - Enero Colones - 2026.xls",
  "/Users/fedepvg/Downloads/Transacciones - Febrero Colones - 2026.xls",
  "/Users/fedepvg/Downloads/Transacciones - Marzo Colones - 2026.xls",
  "/Users/fedepvg/Downloads/Transacciones - Abril Colones - 2026.xls",
];

function parseDate(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
  }
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

// Rule-based categorization for known CRC patterns
function categorize(desc, tipo) {
  const d = desc.toLowerCase();

  // Incoming (credits)
  if (tipo === "ingreso") {
    if (/promotora_comerc|promotora comerc|procomer/i.test(desc)) return { category: "Client Payment", vendor: "PROCOMER - Golden Morpho", notes: "Golden Morpho project payment from PROCOMER" };
    if (/ap 294063105/i.test(desc)) return { category: "Loans & Investment Received", vendor: "PROCOMER", notes: "Investment/loan received for Golden Morpho project - CRC 10M must be recovered" };
    if (/tef de:|cd de:/i.test(desc)) return { category: "Client Payment", vendor: desc, notes: "" };
    if (/intereses/i.test(desc)) return { category: "Bank Fees", vendor: "BAC San José", notes: "Bank interest earned" };
    return { category: "Client Payment", vendor: desc, notes: "" };
  }

  // Outgoing (debits)
  if (/pago intereses.*294063105|pago principal.*294063105|pago intereses cr.*294063105|pago principal cr.*294063105/i.test(desc)) {
    return { category: "Loan Repayment", vendor: "BAC San José - PROCOMER Loan", notes: "Monthly repayment of PROCOMER Golden Morpho investment (ref 294063105)" };
  }
  if (/vid\/pura vida growth.*294063105/i.test(desc)) {
    return { category: "Loan Repayment", vendor: "BAC San José - Loan Insurance", notes: "Loan insurance / vida policy on PROCOMER loan (ref 294063105)" };
  }
  if (/tribu-cr|tributacion|hacienda/i.test(desc)) return { category: "Taxes & Licenses", vendor: "Ministerio de Hacienda (TRIBU-CR)", notes: "Tax payment to Tributación Directa CR" };
  if (/ccss|comision pin-sinpe|pin-sinpe a: 1040/i.test(desc)) return { category: "Taxes & Licenses", vendor: "CCSS", notes: "CCSS / social security" };
  if (/liberty m[oó]vil|movistar/i.test(desc)) return { category: "Rent & Utilities", vendor: "Liberty Móvil (Movistar)", notes: "Business phone / internet" };
  if (/pago \d{4}-\d{2}\*\*-\*\*\*\*-/i.test(desc)) return { category: "Bank Fees", vendor: "BAC San José", notes: "Credit card payment" };
  if (/comision por saldo minimo|comision cd sinpe|comision pin/i.test(desc)) return { category: "Bank Fees", vendor: "BAC San José", notes: "Bank commission" };
  if (/tef a : 941597676/i.test(desc)) return { category: "Contractors & Freelancers", vendor: "WAM Digital (TEF 941597676)", notes: "Golden Morpho project - WAM Digital" };
  if (/tef a : 954545596/i.test(desc)) return { category: "Contractors & Freelancers", vendor: "WAM Digital (TEF 954545596)", notes: "Golden Morpho project - WAM Digital" };
  if (/cd sinpe a 123001/i.test(desc)) return { category: "Contractors & Freelancers", vendor: "WAM Digital (SINPE Banco Nacional)", notes: "Golden Morpho project - WAM Digital via Banco Nacional" };
  if (/tef a : 922699814/i.test(desc)) return { category: "Payroll & Salaries", vendor: "Payroll CRC (TEF 922699814)", notes: "CRC payroll transfer" };
  if (/tef a : 944877521/i.test(desc)) return { category: "Payroll & Salaries", vendor: "Payroll CRC (TEF 944877521)", notes: "CRC payroll transfer" };
  if (/tef a : 926490277/i.test(desc)) return { category: "Payroll & Salaries", vendor: "Payroll CRC (TEF 926490277)", notes: "CRC payroll transfer" };
  if (/tef a : 950519595/i.test(desc)) return { category: "Payroll & Salaries", vendor: "Payroll CRC (TEF 950519595)", notes: "CRC payroll transfer" };
  if (/tef a : 701602492/i.test(desc)) return { category: "Payroll & Salaries", vendor: "Payroll CRC (TEF 701602492)", notes: "CRC payroll transfer" };
  if (/sinpe movil/i.test(desc)) return { category: "Other", vendor: "SINPE Móvil", notes: "SINPE Móvil transfer - unidentified recipient" };
  if (/intereses/i.test(desc)) return { category: "Bank Fees", vendor: "BAC San José", notes: "Bank interest" };

  return { category: "Other", vendor: desc, notes: "" };
}

function parseBACStatement(buf) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const currency = String(rows[6]?.[5] ?? "").trim().toUpperCase() || "CRC";
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
    if (debit === 0 && credit === 0) continue;

    if (debit > 0) transactions.push({ date, desc, amount: debit, tipo: "gasto", currency });
    if (credit > 0) transactions.push({ date, desc, amount: credit, tipo: "ingreso", currency });
  }

  return transactions;
}

async function main() {
  console.log("PVG CRC Bank Import\n");
  let totalImported = 0, totalSkipped = 0, totalErrors = 0;

  for (const filepath of FILES) {
    const filename = filepath.split("/").pop();
    console.log(`\n📄 ${filename}`);

    const buf = readFileSync(filepath);
    const transactions = parseBACStatement(buf);
    console.log(`   ${transactions.filter(t => t.tipo === "gasto").length} débitos, ${transactions.filter(t => t.tipo === "ingreso").length} créditos`);

    for (const t of transactions) {
      const { category, vendor, notes } = categorize(t.desc, t.tipo);

      // Dedup: same date, same amount, same description prefix
      const { data: existing } = await db.from("expenses")
        .select("id")
        .eq("date", t.date)
        .eq("amount", t.amount)
        .eq("currency", t.currency)
        .ilike("description", t.desc.substring(0, 15) + "%")
        .maybeSingle();

      if (existing) {
        process.stdout.write(`   SKIP ${t.date} ${t.desc} ₡${t.amount}\n`);
        totalSkipped++;
        continue;
      }

      const notesFull = `${t.tipo === "gasto" ? "Gasto" : "Ingreso"} · ${filename}${notes ? " · " + notes : ""}`;

      const { error } = await db.from("expenses").insert({
        date: t.date,
        description: t.desc,
        amount: t.amount,
        currency: t.currency,
        category,
        vendor,
        notes: notesFull,
      });

      if (error) {
        console.log(`   ERROR: ${error.message}`);
        totalErrors++;
      } else {
        process.stdout.write(`   OK  ${t.tipo === "gasto" ? "↑" : "↓"} ${t.date} ${t.desc.padEnd(40)} ₡${t.amount.toLocaleString()} → ${category}\n`);
        totalImported++;
      }
    }
  }

  console.log(`\n✓ CRC import complete: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`);
}

main().catch(console.error);
