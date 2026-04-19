import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeBillingStatus, daysOverdue, fmt } from "@/lib/utils";
import { sendFollowUpEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: allInvoices } = await db.from("invoices").select("*");
  const invoices = allInvoices ?? [];

  const { data: settings } = await db.from("settings").select("*");
  const settingsMap: Record<string, string> = {};
  for (const row of settings ?? []) settingsMap[(row as any).key] = (row as any).value ?? "";
  const intervalDays = parseInt(settingsMap["follow_up_interval_days"] ?? "7");

  const now = new Date();
  const sent: string[] = [];
  const skipped: string[] = [];

  for (const inv of invoices) {
    const total = parseFloat(inv.total_amount);
    const paid = parseFloat(inv.paid_amount ?? "0");
    const overdue = daysOverdue(inv.due_date);
    const billing = computeBillingStatus(inv.billing_status ?? "DRAFT", inv.status ?? "pending", inv.due_date, paid, total);

    const needsFollowUp = ["SENT", "DUE_SOON", "DUE_TODAY", "OVERDUE"].includes(billing);
    if (!needsFollowUp || !inv.client_email) { skipped.push(inv.invoice_ref); continue; }

    const lastFollowUp = inv.last_follow_up_at ? new Date(inv.last_follow_up_at) : null;
    const daysSinceLast = lastFollowUp ? Math.floor((now.getTime() - lastFollowUp.getTime()) / 86400000) : 999;
    if (daysSinceLast < intervalDays) { skipped.push(inv.invoice_ref); continue; }

    try {
      await sendFollowUpEmail({
        clientName: inv.client_name,
        clientEmail: inv.client_email,
        invoiceRef: inv.invoice_ref,
        totalAmount: fmt(total - paid, inv.currency ?? "USD"),
        currency: inv.currency ?? "USD",
        dueDate: inv.due_date,
        daysOverdue: overdue,
        followUpCount: (inv.follow_up_count ?? 0) + 1,
        sinpeNumber: inv.sinpe_number,
      });

      await db.from("invoices").update({
        follow_up_count: (inv.follow_up_count ?? 0) + 1,
        last_follow_up_at: now.toISOString(),
      }).eq("id", inv.id);

      await db.from("billing_activity").insert({
        invoice_id: inv.id,
        action: "follow_up_sent",
        description: `Batch follow-up email sent${overdue >= 14 ? " (urgent)" : ""}`,
        performed_by: "system",
      });

      sent.push(inv.invoice_ref);
    } catch {
      skipped.push(inv.invoice_ref);
    }
  }

  return NextResponse.json({ sent, skipped, total: sent.length });
}
