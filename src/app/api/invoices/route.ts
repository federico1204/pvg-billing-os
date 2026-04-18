import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { nextInvoiceRef, computeBillingStatus, daysOverdue } from "@/lib/utils";

export async function GET(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const { data, error } = await db.from("invoices").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data ?? []).map((inv: any) => {
    const total = parseFloat(inv.total_amount);
    const paid = parseFloat(inv.paid_amount ?? "0");
    const overdue = daysOverdue(inv.due_date);
    const billing = computeBillingStatus(inv.billing_status ?? "DRAFT", inv.status ?? "pending", inv.due_date, paid, total);
    return { ...inv, totalAmount: total, paidAmount: paid, balanceRemaining: Math.max(0, total - paid), daysOverdue: overdue, billingStatus: billing };
  });

  if (statusFilter) return NextResponse.json(enriched.filter((i: any) => i.billingStatus === statusFilter));
  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const { data: last } = await db.from("invoices").select("invoice_ref").order("id", { ascending: false }).limit(1);
  const invoiceRef = nextInvoiceRef(last?.[0]?.invoice_ref);

  const { data, error } = await db.from("invoices").insert({
    invoice_ref: invoiceRef,
    client_name: body.clientName,
    client_email: body.clientEmail,
    client_company: body.clientCompany,
    project_name: body.projectName,
    total_amount: body.totalAmount,
    currency: body.currency || "USD",
    invoice_type: body.invoiceType || "standard",
    due_date: body.dueDate,
    sinpe_number: body.sinpeNumber,
    notes: body.notes,
    billing_status: "DRAFT",
    status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
