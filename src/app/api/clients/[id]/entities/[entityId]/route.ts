import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, entityId } = await params;

  const body = await req.json();
  const {
    entityName,
    entityType,
    entityEmail,
    entityPhone,
    isInvoiceRecipient,
    isPayer,
    billingSplitPercentage,
    splitOrder,
    notes,
  } = body;

  const updates: Record<string, unknown> = {};
  if (entityName !== undefined) updates.entity_name = entityName;
  if (entityType !== undefined) updates.entity_type = entityType;
  if (entityEmail !== undefined) updates.entity_email = entityEmail;
  if (entityPhone !== undefined) updates.entity_phone = entityPhone;
  if (isInvoiceRecipient !== undefined) updates.is_invoice_recipient = isInvoiceRecipient;
  if (isPayer !== undefined) updates.is_payer = isPayer;
  if (billingSplitPercentage !== undefined) updates.billing_split_percentage = billingSplitPercentage;
  if (splitOrder !== undefined) updates.split_order = splitOrder;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await db
    .from("client_entities")
    .update(updates)
    .eq("id", entityId)
    .eq("client_id", id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, entityId } = await params;

  const { error } = await db
    .from("client_entities")
    .delete()
    .eq("id", entityId)
    .eq("client_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
