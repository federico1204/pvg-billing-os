import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { billingStatus } = await req.json();
  const invoiceId = parseInt(id);

  await db.from("invoices").update({ billing_status: billingStatus, updated_at: new Date().toISOString() }).eq("id", invoiceId);
  await db.from("billing_activity").insert({
    invoice_id: invoiceId, action_type: "STATUS_UPDATED",
    description: `Billing status changed to ${billingStatus}`,
    performed_by: "admin",
  });

  return NextResponse.json({ ok: true });
}
