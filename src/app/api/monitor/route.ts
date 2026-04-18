import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { runInvoiceMonitor } from "@/lib/ai";
import { daysOverdue, computeBillingStatus } from "@/lib/utils";

export async function POST(_req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: all } = await db.from("invoices").select("*");
  const open = (all ?? []).filter((i: any) => i.status !== "paid" && i.status !== "cancelled");

  const enriched = open.map((inv: any) => {
    const total = parseFloat(inv.total_amount);
    const paid = parseFloat(inv.paid_amount ?? "0");
    const overdue = daysOverdue(inv.due_date);
    const billing = computeBillingStatus(inv.billing_status ?? "DRAFT", inv.status ?? "pending", inv.due_date, paid, total);
    return {
      id: inv.id, ref: inv.invoice_ref,
      client: inv.client_name + (inv.client_company ? ` (${inv.client_company})` : ""),
      project: inv.project_name,
      balance: (inv.currency === "CRC" ? "₡" : "$") + Math.max(0, total - paid).toLocaleString(),
      balanceRemaining: Math.max(0, total - paid),
      daysOverdue: overdue, billingStatus: billing,
      followUpCount: inv.follow_up_count ?? 0,
      daysSinceLastFollowUp: inv.last_follow_up_at
        ? Math.round((Date.now() - new Date(inv.last_follow_up_at).getTime()) / 86400000) : null,
      invoiceSent: !!inv.sent_at,
    };
  });

  const report = await runInvoiceMonitor(enriched);
  return NextResponse.json(report);
}
