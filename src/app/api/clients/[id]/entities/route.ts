import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await db
    .from("client_entities")
    .select("*")
    .eq("client_id", id)
    .order("split_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

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

  const { data, error } = await db
    .from("client_entities")
    .insert({
      client_id: id,
      entity_name: entityName,
      entity_type: entityType,
      entity_email: entityEmail ?? null,
      entity_phone: entityPhone ?? null,
      is_invoice_recipient: isInvoiceRecipient ?? false,
      is_payer: isPayer ?? false,
      billing_split_percentage: billingSplitPercentage ?? null,
      split_order: splitOrder ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
