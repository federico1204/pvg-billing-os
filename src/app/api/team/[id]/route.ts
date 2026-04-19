import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.personName !== undefined) updates.person_name = body.personName;
  if (body.role !== undefined) updates.role = body.role;
  if (body.monthlyCost !== undefined) updates.monthly_cost = body.monthlyCost;
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.sinpeNumber !== undefined) updates.sinpe_number = body.sinpeNumber;
  if (body.iban !== undefined) updates.iban = body.iban;
  if (body.idNumber !== undefined) updates.id_number = body.idNumber;
  if (body.paymentMethodPreferred !== undefined) updates.payment_method_preferred = body.paymentMethodPreferred;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.isActive !== undefined) updates.is_active = body.isActive;

  const { data, error } = await db.from("team_costs").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
