import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeBillingStatus, daysOverdue } from "@/lib/utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: inv }, { data: pays }, { data: activities }] = await Promise.all([
    db.from("invoices").select("*").eq("id", parseInt(id)).single(),
    db.from("payments").select("*").eq("invoice_id", parseInt(id)).order("paid_at", { ascending: false }),
    db.from("billing_activity").select("*").eq("invoice_id", parseInt(id)).order("created_at", { ascending: false }),
  ]);

  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const total = parseFloat(inv.total_amount);
  const paid = parseFloat(inv.paid_amount ?? "0");
  const overdue = daysOverdue(inv.due_date);
  const billing = computeBillingStatus(inv.billing_status ?? "DRAFT", inv.status ?? "pending", inv.due_date, paid, total);

  return NextResponse.json({
    ...inv,
    totalAmount: total, paidAmount: paid,
    balanceRemaining: Math.max(0, total - paid),
    daysOverdue: overdue, billingStatus: billing,
    payments: pays ?? [], activities: activities ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { data, error } = await db.from("invoices").update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", parseInt(id)).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
