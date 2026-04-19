import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all invoices and existing recurring templates
  const [{ data: invoices }, { data: templates }] = await Promise.all([
    db.from("invoices").select("id, client_id, client_name, client_company, total_amount, currency, invoice_date, billing_status, project_name"),
    db.from("recurring_invoices").select("client_id, is_active"),
  ]);

  const allInvoices = invoices ?? [];
  const activeTemplateClientIds = new Set(
    (templates ?? []).filter(t => t.is_active).map(t => t.client_id)
  );

  // Group invoices by client
  const byClient: Record<number, typeof allInvoices> = {};
  for (const inv of allInvoices) {
    if (!inv.client_id) continue;
    if (!byClient[inv.client_id]) byClient[inv.client_id] = [];
    byClient[inv.client_id].push(inv);
  }

  const suggestions: Array<{
    clientId: number;
    clientName: string;
    invoiceCount: number;
    suggestedAmount: number;
    currency: string;
    confidence: "high" | "medium" | "low";
    reason: string;
    avgAmount: number;
    lastProject: string | null;
    hasTemplate: boolean;
  }> = [];

  for (const [clientIdStr, invs] of Object.entries(byClient)) {
    const clientId = parseInt(clientIdStr);
    if (invs.length < 2) continue; // Need at least 2 invoices to suggest recurring

    const hasTemplate = activeTemplateClientIds.has(clientId);

    // Sort by date
    const sorted = [...invs].sort((a, b) =>
      new Date(a.invoice_date ?? "2000-01-01").getTime() - new Date(b.invoice_date ?? "2000-01-01").getTime()
    );

    const amounts = sorted.map(i => parseFloat(i.total_amount ?? "0")).filter(a => a > 0);
    if (amounts.length < 2) continue;

    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    const amountVariance = maxAmount > 0 ? (maxAmount - minAmount) / maxAmount : 0;

    // Dominant currency
    const currencyCount: Record<string, number> = {};
    for (const inv of invs) {
      const c = inv.currency ?? "USD";
      currencyCount[c] = (currencyCount[c] ?? 0) + 1;
    }
    const currency = Object.entries(currencyCount).sort((a, b) => b[1] - a[1])[0][0];

    // Suggested amount: most common amount or average (rounded)
    const amountFreq: Record<string, number> = {};
    for (const a of amounts) {
      const key = Math.round(a / 50) * 50; // bucket to nearest $50
      amountFreq[key] = (amountFreq[key] ?? 0) + 1;
    }
    const mostCommonBucket = parseInt(Object.entries(amountFreq).sort((a, b) => b[1] - a[1])[0][0]);
    const suggestedAmount = amountVariance < 0.1 ? Math.round(avgAmount) : mostCommonBucket;

    // Confidence score
    let confidence: "high" | "medium" | "low";
    let reason: string;

    if (invs.length >= 4 && amountVariance < 0.1) {
      confidence = "high";
      reason = `${invs.length} invoices at consistent ${currency} ${Math.round(avgAmount).toLocaleString("en-US")} — strong retainer pattern`;
    } else if (invs.length >= 3) {
      confidence = amountVariance < 0.2 ? "high" : "medium";
      reason = `${invs.length} invoices, avg ${currency} ${Math.round(avgAmount).toLocaleString("en-US")} · amounts ${amountVariance < 0.2 ? "very consistent" : "vary slightly"}`;
    } else {
      confidence = "low";
      reason = `${invs.length} invoices — may be project-based, worth reviewing`;
    }

    const lastProject = sorted[sorted.length - 1]?.project_name ?? null;

    suggestions.push({
      clientId,
      clientName: invs[0].client_name ?? invs[0].client_company ?? `Client ${clientId}`,
      invoiceCount: invs.length,
      suggestedAmount,
      currency,
      confidence,
      reason,
      avgAmount: Math.round(avgAmount),
      lastProject,
      hasTemplate,
    });
  }

  // Sort: no template first (most actionable), then by confidence + invoice count
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => {
    if (a.hasTemplate !== b.hasTemplate) return a.hasTemplate ? 1 : -1;
    if (a.confidence !== b.confidence) return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    return b.invoiceCount - a.invoiceCount;
  });

  return NextResponse.json(suggestions);
}
