import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextInvoiceRef } from "@/lib/utils";

function advanceDate(current: string, frequency: string, dayOfMonth: number): string {
  const d = new Date(current + "T12:00:00Z");
  if (frequency === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else if (frequency === "bi_monthly") {
    d.setMonth(d.getMonth() + 2);
  } else if (frequency === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else if (frequency === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  // Set to the configured day of month (clamped to end of month)
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dayOfMonth, maxDay));
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Fetch the recurring invoice template
  const { data: template, error: tErr } = await db
    .from("recurring_invoices")
    .select("*, clients(id, commercial_name, llc_name, name, email, billing_email, preferred_language, sinpe_number)")
    .eq("id", id)
    .single();

  if (tErr || !template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!template.is_active) return NextResponse.json({ error: "Template is paused" }, { status: 400 });

  const client = (template as any).clients;
  const clientEmail = client?.billing_email || client?.email || "";
  const clientName = client?.commercial_name || client?.name || "";
  const clientCompany = client?.llc_name || clientName;

  // Build due date: 30 days from today
  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Get next invoice ref
  const { data: last } = await db.from("invoices").select("invoice_ref").order("id", { ascending: false }).limit(1);
  const invoiceRef = nextInvoiceRef(last?.[0]?.invoice_ref);

  // Create the invoice
  const { data: invoice, error: iErr } = await db.from("invoices").insert({
    invoice_ref: invoiceRef,
    client_name: clientName,
    client_email: clientEmail,
    client_company: clientCompany,
    project_name: template.name,
    total_amount: template.amount,
    currency: template.currency,
    invoice_date: today,
    due_date: dueDate,
    sinpe_number: client?.sinpe_number,
    notes: template.description,
    line_items: [
      {
        description: template.name,
        quantity: 1,
        unit_price: parseFloat(template.amount),
        total: parseFloat(template.amount),
      },
    ],
    billing_status: "DRAFT",
    status: "pending",
    invoice_type: "standard",
  }).select().single();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  // Advance the next_run_date
  const nextRunDate = advanceDate(
    template.next_run_date,
    template.frequency,
    template.day_of_month ?? 1
  );

  await db.from("recurring_invoices").update({
    last_run_date: today,
    next_run_date: nextRunDate,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  // Log to activity
  await db.from("billing_activity").insert({
    invoice_id: (invoice as any).id,
    event_type: "invoice_created",
    notes: `Auto-generated from recurring template "${template.name}" (ID ${id})`,
  }).select();

  return NextResponse.json({ invoice, nextRunDate }, { status: 201 });
}
