import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmt, daysOverdue } from "@/lib/utils";
import { sendInvoiceEmail, sendFollowUpEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { type } = await req.json();
  const invoiceId = parseInt(id);

  const { data: invRaw } = await db.from("invoices").select("*").eq("id", invoiceId).single();
  const inv = invRaw as any;
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!inv.client_email) return NextResponse.json({ error: "No client email" }, { status: 400 });

  const total = parseFloat(inv.total_amount);
  const paid = parseFloat(inv.paid_amount ?? "0");
  const balance = Math.max(0, total - paid);
  const overdue = daysOverdue(inv.due_date);

  const emailData = {
    clientName: inv.client_name, clientEmail: inv.client_email,
    invoiceRef: inv.invoice_ref, projectName: inv.project_name,
    totalAmount: fmt(balance, inv.currency ?? "USD"),
    dueDate: inv.due_date, currency: inv.currency ?? "USD",
    sinpeNumber: inv.sinpe_number,
  };

  if (type === "invoice") {
    await sendInvoiceEmail(emailData);
    await db.from("invoices").update({ sent_at: new Date().toISOString(), billing_status: "SENT", updated_at: new Date().toISOString() }).eq("id", invoiceId);
    await db.from("billing_activity").insert({
      invoice_id: invoiceId, action_type: "INVOICE_SENT",
      description: `Invoice sent to ${inv.client_email}`,
      performed_by: "admin", email_sent: true,
      email_subject: `Invoice ${inv.invoice_ref} — ${fmt(total, inv.currency ?? "USD")}`,
    });
  } else {
    await sendFollowUpEmail({ ...emailData, daysOverdue: overdue, followUpCount: (inv.follow_up_count ?? 0) + 1 });
    await db.from("invoices").update({
      follow_up_count: (inv.follow_up_count ?? 0) + 1,
      last_follow_up_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", invoiceId);
    await db.from("billing_activity").insert({
      invoice_id: invoiceId, action_type: "FOLLOW_UP_SENT",
      description: `Follow-up sent to ${inv.client_email} (${overdue}d overdue)`,
      performed_by: "admin", email_sent: true,
      email_subject: overdue >= 14 ? `[URGENT] Invoice ${inv.invoice_ref}` : `Reminder: Invoice ${inv.invoice_ref}`,
    });
  }

  return NextResponse.json({ ok: true });
}
