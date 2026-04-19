import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmt } from "@/lib/utils";
import { sendPaymentConfirmedEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const invoiceId = parseInt(id);

  const { data: invRaw } = await db.from("invoices").select("*").eq("id", invoiceId).single();
  const inv = invRaw as any;
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.from("payments").insert({
    invoice_id: invoiceId,
    amount: body.amount,
    method: body.method || "bank_transfer",
    reference: body.reference,
    notes: body.notes,
  });

  const newPaid = parseFloat(inv.paid_amount ?? "0") + parseFloat(body.amount);
  const total = parseFloat(inv.total_amount);
  const isFullyPaid = newPaid >= total;

  await db.from("invoices").update({
    paid_amount: newPaid,
    status: isFullyPaid ? "paid" : "pending",
    billing_status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
    updated_at: new Date().toISOString(),
  }).eq("id", invoiceId);

  await db.from("billing_activity").insert({
    invoice_id: invoiceId,
    action_type: "PAYMENT_RECORDED",
    description: `Payment of ${fmt(parseFloat(body.amount), inv.currency ?? "USD")} via ${body.method || "bank_transfer"}${body.reference ? ` · Ref: ${body.reference}` : ""}`,
    performed_by: "admin",
    email_sent: false,
  });

  if (body.sendEmail && inv.client_email) {
    const balance = Math.max(0, total - newPaid);
    try {
      await sendPaymentConfirmedEmail({
        clientName: inv.client_name, clientEmail: inv.client_email,
        invoiceRef: inv.invoice_ref, totalAmount: fmt(total, inv.currency ?? "USD"),
        dueDate: inv.due_date, currency: inv.currency ?? "USD",
        isPartial: !isFullyPaid, balanceRemaining: fmt(balance, inv.currency ?? "USD"),
      });
      await db.from("billing_activity").insert({
        invoice_id: invoiceId, action_type: "EMAIL_SENT",
        description: `Payment confirmation sent to ${inv.client_email}`,
        performed_by: "admin", email_sent: true,
        email_subject: `Payment ${isFullyPaid ? "confirmed" : "received"} — Invoice ${inv.invoice_ref}`,
      });
    } catch { /* email optional */ }
  }

  return NextResponse.json({ ok: true, isFullyPaid });
}
