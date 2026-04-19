/**
 * PVG Payment Reconciliation
 * Matches bank income entries (credits) to invoices by amount + client name keywords,
 * then marks matched invoices as PAID.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
});

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// Bank description → canonical client name aliases
// Bank truncates company names and uses legal names that differ from commercial names
const BANK_ALIASES = [
  { bankPattern: /electroaire/i, clientName: "Beeche Hotels" },
  { bankPattern: /vida deportiva/i, clientName: "Grupo AVA" },
  { bankPattern: /auxilio empresarial/i, clientName: "Grupo AVA" },
  { bankPattern: /decoraciones avanzadas|dekora/i, clientName: "DEKORA" },
  { bankPattern: /tech marine/i, clientName: "TM&L" },
  { bankPattern: /turismo y expediciones|puma expeditions/i, clientName: "Puma Expeditions" },
  { bankPattern: /emprendimientos conscientes|wo kapi|wokapi/i, clientName: "Wo Kapi" },
  { bankPattern: /daphna|daphys/i, clientName: "Daphys Cafe" },
  { bankPattern: /monica morandi|re.?lab/i, clientName: "RE-LAB" },
  { bankPattern: /ricardo montero/i, clientName: "RE-LAB" },
  { bankPattern: /memorable travel/i, clientName: "MEMORABLE TRAVEL GROUP DMC SOCIEDAD ANONIMA" },
  { bankPattern: /stay in tamarindo/i, clientName: "STAY IN TAMARINDO LLC SOCIEDAD DE RESPONSABILIDAD LIMITADA" },
  { bankPattern: /good food/i, clientName: "Good Food S.A." },
  { bankPattern: /petrax/i, clientName: "PETRAX SOLUCIONES Y MAQUINARIA S.A" },
  { bankPattern: /hughes/i, clientName: "Hughes Ventures, Inc." },
];

// Resolve bank description to canonical client name via aliases, then keyword match
function resolveAlias(bankDesc) {
  for (const alias of BANK_ALIASES) {
    if (alias.bankPattern.test(bankDesc)) return alias.clientName;
  }
  return null;
}

// Keywords from bank description → partial client name matches
// Bank truncates names at ~30 chars
function nameKeywords(str) {
  return str.toLowerCase()
    .replace(/tef de:/i, "")
    .replace(/cd sinpe /i, "")
    .replace(/sinpe-pin de: /i, "")
    .replace(/sinpe /i, "")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 3);
}

function clientMatchScore(bankDesc, clientName, clientCommercialName) {
  // Check alias first — if it matches, give a strong base score
  const aliasMatch = resolveAlias(bankDesc);
  const commercialLower = (clientCommercialName || clientName || "").toLowerCase();
  const legalLower = (clientName || "").toLowerCase();
  if (aliasMatch) {
    const aliasLower = aliasMatch.toLowerCase();
    if (commercialLower.includes(aliasLower) || aliasLower.includes(commercialLower.split(" ")[0])) return 20;
    if (legalLower.includes(aliasLower.split(" ")[0])) return 15;
  }

  const bankWords = nameKeywords(bankDesc);
  const clientWords = `${clientName} ${clientCommercialName || ""}`.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  let matches = 0;
  for (const bw of bankWords) {
    for (const cw of clientWords) {
      if (cw.startsWith(bw) || bw.startsWith(cw)) matches++;
    }
  }
  return matches;
}

async function main() {
  console.log("PVG Payment Reconciliation\n");

  // Get all income entries from bank statements
  const { data: incomeEntries } = await db.from("expenses")
    .select("id, date, description, amount, currency")
    .like("notes", "%Ingreso%")
    .order("date", { ascending: true });

  // Get all unpaid/partial invoices
  const { data: invoices } = await db.from("invoices")
    .select("id, invoice_ref, client_name, client_llc_name, client_commercial_name, total_amount, paid_amount, billing_status, invoice_date, due_date")
    .not("billing_status", "eq", "PAID")
    .not("billing_status", "eq", "CANCELLED")
    .order("invoice_date", { ascending: true });

  console.log(`Income entries: ${incomeEntries.length}`);
  console.log(`Unpaid invoices: ${invoices.length}\n`);

  const matched = [];
  const usedInvoices = new Set();

  for (const entry of incomeEntries) {
    const amount = parseFloat(entry.amount);

    // Find invoices with matching amount (exact) that haven't been matched yet
    const candidates = invoices.filter(inv => {
      if (usedInvoices.has(inv.id)) return false;
      const invTotal = parseFloat(inv.total_amount);
      const invPaid = parseFloat(inv.paid_amount ?? 0);
      const remaining = invTotal - invPaid;
      return Math.abs(remaining - amount) < 0.02 || Math.abs(invTotal - amount) < 0.02;
    });

    if (candidates.length === 0) continue;

    // Score by name match + date proximity (payment should be after invoice date)
    const clientName = entry.description;
    let best = null;
    let bestScore = -1;

    for (const inv of candidates) {
      const invDate = new Date(inv.invoice_date);
      const payDate = new Date(entry.date);
      const daysDiff = (payDate - invDate) / 86400000;
      if (daysDiff < -5) continue; // Payment before invoice by more than 5 days = skip

      const nameScore = clientMatchScore(clientName, inv.client_llc_name || inv.client_name, inv.client_commercial_name);
      // Favor closer dates, higher name match
      const score = nameScore * 10 - Math.max(0, daysDiff - 30);

      if (score > bestScore) {
        bestScore = score;
        best = inv;
      }
    }

    if (best && bestScore >= 0) {
      matched.push({ entry, invoice: best, score: bestScore });
      usedInvoices.add(best.id);
    }
  }

  console.log(`Matched ${matched.length} payments to invoices:\n`);

  let updated = 0;
  for (const { entry, invoice, score } of matched) {
    const amount = parseFloat(entry.amount);
    console.log(`  ✓ ${entry.date} ${entry.description} $${amount}`);
    console.log(`    → ${invoice.invoice_ref} ${invoice.client_name} $${invoice.total_amount} [score: ${score.toFixed(1)}]`);

    const { error } = await db.from("invoices").update({
      paid_amount: amount,
      billing_status: "PAID",
      status: "paid",
      updated_at: new Date().toISOString(),
    }).eq("id", invoice.id);

    if (error) {
      console.log(`    ERROR: ${error.message}`);
    } else {
      // Log payment
      await db.from("payments").insert({
        invoice_id: invoice.id,
        amount,
        currency: entry.currency,
        payment_date: entry.date,
        method: "bank_transfer",
        notes: `Auto-reconciled from bank: ${entry.description}`,
      }).select().single();
      updated++;
    }
  }

  console.log(`\n✓ Reconciliation complete: ${updated} invoices marked as PAID`);

  // Show unmatched income entries
  const matchedEntryIds = new Set(matched.map(m => m.entry.id));
  const unmatched = incomeEntries.filter(e => !matchedEntryIds.has(e.id));
  if (unmatched.length > 0) {
    console.log(`\nUnmatched income entries (${unmatched.length}) — may need manual review:`);
    for (const e of unmatched) {
      console.log(`  ${e.date} ${e.description} $${e.amount}`);
    }
  }
}

main().catch(console.error);
