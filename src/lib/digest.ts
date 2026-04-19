/**
 * PVG Financial Digest — AI-powered twice-weekly briefing for Federico.
 * Uses claude-opus-4-5 for deep analysis: P&L snapshot, cash priorities,
 * collections urgency, recurring billing reminders, and strategic recommendations.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { db } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const DIGEST_TO = "federico@puravidagrowth.com";
const DIGEST_FROM = "Pura Vida Growth Billing <billing@puravidagrowth.com>";

interface DigestData {
  invoices: any[];
  expenses: any[];
  recurring: any[];
  clients: any[];
}

async function gatherData(): Promise<DigestData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [invoicesRes, expensesRes, recurringRes, clientsRes] = await Promise.all([
    db.from("invoices")
      .select("invoice_ref, client_name, total_amount, paid_amount, due_date, billing_status, status, currency, created_at, invoice_date")
      .order("due_date", { ascending: true }),
    db.from("expenses")
      .select("date, description, amount, currency, category, notes")
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: false }),
    db.from("recurring_invoices")
      .select("id, name, amount, currency, frequency, next_run_date, is_active, clients(commercial_name, billing_email, email)")
      .eq("is_active", true)
      .lte("next_run_date", in14Days)
      .order("next_run_date", { ascending: true }),
    db.from("clients")
      .select("id, commercial_name, email, billing_email, billing_notes, team_lead, is_active")
      .eq("is_active", true),
  ]);

  return {
    invoices: invoicesRes.data ?? [],
    expenses: expensesRes.data ?? [],
    recurring: recurringRes.data ?? [],
    clients: clientsRes.data ?? [],
  };
}

function buildContext(data: DigestData, today: string): string {
  const { invoices, expenses, recurring, clients } = data;

  // Classify invoices
  const open = invoices.filter((i: any) =>
    !["PAID", "CANCELLED", "DRAFT"].includes(i.billing_status ?? "")
  );
  const overdue = open.filter((i: any) => i.due_date < today);
  const dueSoon = open.filter((i: any) => i.due_date >= today && i.due_date <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const drafts = invoices.filter((i: any) => i.billing_status === "DRAFT");

  const totalOutstanding = open.reduce((s: number, i: any) => s + (parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0)), 0);
  const totalOverdue = overdue.reduce((s: number, i: any) => s + (parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0)), 0);

  // 30-day P&L
  const usdIncome = expenses
    .filter((e: any) => e.currency === "USD" && (e.notes?.startsWith("Ingreso") || e.category === "Client Payment"))
    .reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
  const usdExpenses = expenses
    .filter((e: any) => e.currency === "USD" && !e.notes?.startsWith("Ingreso") && e.category !== "Client Payment")
    .reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
  const crcIncome = expenses
    .filter((e: any) => e.currency === "CRC" && e.notes?.startsWith("Ingreso"))
    .reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
  const crcExpenses = expenses
    .filter((e: any) => e.currency === "CRC" && !e.notes?.startsWith("Ingreso"))
    .reduce((s: number, e: any) => s + parseFloat(e.amount), 0);

  // Upcoming recurring
  const recurringDue = recurring.map((r: any) => ({
    name: r.name,
    client: (r.clients as any)?.commercial_name ?? "Unknown",
    amount: parseFloat(r.amount),
    currency: r.currency,
    dueDate: r.next_run_date,
    daysUntil: Math.round((new Date(r.next_run_date + "T12:00:00").getTime() - Date.now()) / 86400000),
  }));

  return `
=== PURA VIDA GROWTH — FINANCIAL BRIEFING DATA ===
Date: ${today}
Agency: Pura Vida Growth | Federico Rojas | Costa Rica

--- INVOICE HEALTH ---
Total outstanding: $${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}
Total overdue: $${totalOverdue.toLocaleString("en-US", { minimumFractionDigits: 2 })} (${overdue.length} invoices)
Due within 7 days: ${dueSoon.length} invoices
Unsent drafts: ${drafts.length}

OVERDUE INVOICES (priority — needs action NOW):
${overdue.length === 0 ? "None" : overdue.map((i: any) => {
    const balance = parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0);
    const daysLate = Math.round((Date.now() - new Date(i.due_date).getTime()) / 86400000);
    return `• ${i.client_name} — ${i.invoice_ref} — $${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} — ${daysLate} days late — Status: ${i.billing_status}`;
  }).join("\n")}

DRAFTS NOT YET SENT:
${drafts.length === 0 ? "None" : drafts.map((i: any) => `• ${i.client_name} — ${i.invoice_ref} — $${parseFloat(i.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} — Created: ${i.created_at?.slice(0, 10)}`).join("\n")}

DUE IN NEXT 7 DAYS:
${dueSoon.length === 0 ? "None" : dueSoon.map((i: any) => {
    const balance = parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0);
    return `• ${i.client_name} — ${i.invoice_ref} — $${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} — Due: ${i.due_date}`;
  }).join("\n")}

--- 30-DAY CASH FLOW (last 30 days) ---
USD: Income $${usdIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Expenses $${usdExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })} | Net $${(usdIncome - usdExpenses).toLocaleString("en-US", { minimumFractionDigits: 2 })}
CRC: Income ₡${Math.round(crcIncome).toLocaleString("en-US")} | Expenses ₡${Math.round(crcExpenses).toLocaleString("en-US")} | Net ₡${Math.round(crcIncome - crcExpenses).toLocaleString("en-US")}

--- RECURRING INVOICES DUE IN NEXT 14 DAYS ---
${recurringDue.length === 0 ? "None" : recurringDue.map((r: any) => `• ${r.client} — ${r.name} — $${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} — Due: ${r.dueDate} (${r.daysUntil <= 0 ? "TODAY/OVERDUE" : `in ${r.daysUntil} days`})`).join("\n")}

--- ACTIVE CLIENTS (${clients.length}) ---
${clients.map((c: any) => `• ${c.commercial_name}${c.team_lead ? ` [lead: ${c.team_lead.split("@")[0]}]` : ""}`).join("\n")}
`.trim();
}

async function callAI(context: string, today: string): Promise<string> {
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Costa_Rica" });

  const systemPrompt = `You are the CFO AI advisor for Pura Vida Growth, a marketing agency in Costa Rica run by Federico Rojas.

Your job is to send Federico a sharp, actionable financial briefing twice a week (Monday and Thursday mornings).

Federico is the agency owner. He needs to know:
1. EXACTLY what to do today — specific client names, invoice numbers, amounts
2. What's at financial risk and why
3. Whether cash flow is healthy or needs attention
4. Who to invoice this week (from recurring templates)
5. Any patterns worth calling out

TONE: Direct, confident, like a trusted CFO. Not generic. Not fluffy. No filler phrases.
Use plain English. Bullet points for actions. Numbers matter — always include dollar amounts.
No markdown headers with ## — use ALL CAPS for section headings.
Keep it under 600 words.

FORMAT:
SITUATION (2-3 sentences on overall health)

IMMEDIATE ACTION REQUIRED (numbered list — do these today)
1. ...

INVOICE THIS WEEK (recurring templates to generate)
- ...

CASH FLOW WATCH
...

WHAT TO MONITOR (not urgent but worth watching)
- ...

STRATEGIC NOTE (one insight about the business — patterns, risks, opportunities)
...`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `${dayName}, ${today}. Here is this week's financial data:\n\n${context}`,
    }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "Error generating digest.";
}

function buildEmailHtml(analysis: string, today: string, data: DigestData): string {
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Costa_Rica", month: "long", day: "numeric" });

  // Format the text analysis into HTML
  const htmlContent = analysis
    .split("\n")
    .map(line => {
      line = line.trim();
      if (!line) return "<br>";
      // ALL CAPS section headings
      if (/^[A-Z][A-Z\s()]+$/.test(line) && line.length < 60) {
        return `<p style="margin:24px 0 8px;font-size:11px;font-weight:700;letter-spacing:1px;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:6px">${line}</p>`;
      }
      // Numbered actions
      if (/^\d+\./.test(line)) {
        return `<p style="margin:6px 0;padding-left:8px;color:#111827"><span style="color:#ef4444;font-weight:700">${line.split(".")[0]}.</span>${line.slice(line.indexOf(".") + 1)}</p>`;
      }
      // Bullets
      if (line.startsWith("- ") || line.startsWith("• ")) {
        const text = line.slice(2);
        return `<p style="margin:5px 0;padding-left:12px;color:#374151">→ ${text}</p>`;
      }
      return `<p style="margin:6px 0;color:#374151">${line}</p>`;
    })
    .join("");

  // Quick stats bar
  const open = data.invoices.filter((i: any) => !["PAID", "CANCELLED", "DRAFT"].includes(i.billing_status ?? ""));
  const overdue = open.filter((i: any) => i.due_date < today);
  const totalOutstanding = open.reduce((s: number, i: any) => s + (parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0)), 0);
  const totalOverdue = overdue.reduce((s: number, i: any) => s + (parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0)), 0);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#0a0a0a;padding:28px 32px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="color:#22c55e;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Pura Vida Growth</div>
        <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:4px">Financial Digest</div>
        <div style="color:#6b7280;font-size:13px;margin-top:2px">${dayName}</div>
      </div>
      <div style="text-align:right">
        <a href="https://pvg-billing-os.vercel.app/dashboard" style="background:#22c55e;color:#000000;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700">Open Dashboard →</a>
      </div>
    </div>

    <!-- Quick stats -->
    <div style="background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:16px 32px;display:flex;gap:32px">
      <div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Outstanding</div>
        <div style="font-size:20px;font-weight:700;color:#111827">$${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Overdue</div>
        <div style="font-size:20px;font-weight:700;color:${totalOverdue > 0 ? "#ef4444" : "#22c55e"}">$${totalOverdue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Overdue Invoices</div>
        <div style="font-size:20px;font-weight:700;color:${overdue.length > 0 ? "#ef4444" : "#22c55e"}">${overdue.length}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Recurring Due</div>
        <div style="font-size:20px;font-weight:700;color:#111827">${data.recurring.length}</div>
      </div>
    </div>

    <!-- AI Analysis -->
    <div style="padding:28px 32px">
      ${htmlContent}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        This digest is generated automatically by PVG Billing OS ·
        <a href="https://pvg-billing-os.vercel.app/dashboard" style="color:#22c55e">Open Dashboard</a> ·
        <a href="https://pvg-billing-os.vercel.app/dashboard/invoices" style="color:#22c55e">Invoices</a> ·
        <a href="https://pvg-billing-os.vercel.app/dashboard/recurring" style="color:#22c55e">Recurring</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function runDigest(forceRun = false): Promise<{ ok: boolean; message: string; preview?: string }> {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" }); // YYYY-MM-DD

    const data = await gatherData();
    const context = buildContext(data, today);
    const analysis = await callAI(context, today);
    const html = buildEmailHtml(analysis, today, data);

    const dayName = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Costa_Rica" });

    const open = data.invoices.filter((i: any) => !["PAID", "CANCELLED", "DRAFT"].includes(i.billing_status ?? ""));
    const overdue = open.filter((i: any) => i.due_date < today);
    const subjectUrgency = overdue.length > 0 ? `🔴 ${overdue.length} overdue · ` : "";
    const totalOutstanding = open.reduce((s: number, i: any) => s + (parseFloat(i.total_amount) - parseFloat(i.paid_amount ?? 0)), 0);

    await resend.emails.send({
      from: DIGEST_FROM,
      to: DIGEST_TO,
      subject: `${subjectUrgency}PVG Digest — ${dayName} · $${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} outstanding`,
      html,
    });

    // Log to billing_activity
    await db.from("billing_activity").insert({
      event_type: "digest_sent",
      notes: `Financial digest sent to ${DIGEST_TO}. Outstanding: $${totalOutstanding.toFixed(2)}, Overdue: ${overdue.length}`,
    });

    return { ok: true, message: "Digest sent successfully", preview: analysis };
  } catch (err: any) {
    console.error("Digest error:", err);
    return { ok: false, message: err.message ?? "Unknown error" };
  }
}
