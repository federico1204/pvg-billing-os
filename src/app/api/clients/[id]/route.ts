import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: client, error } = await db.from("clients").select("*").eq("id", id).single();
  if (error || !client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Collect all emails to query — own email + any sibling clients sharing same commercial_name
  const ownEmail = (client as any).email;
  const emails: string[] = ownEmail ? [ownEmail] : [];

  // If this client has sibling LLCs (same commercial_name), include their invoices too
  if ((client as any).commercial_name) {
    const { data: siblings } = await db.from("clients")
      .select("email")
      .eq("commercial_name", (client as any).commercial_name)
      .neq("id", id);
    for (const s of siblings ?? []) {
      if (s.email && !emails.includes(s.email)) emails.push(s.email);
    }
  }

  let invoicesQuery = db.from("invoices").select("*").order("created_at", { ascending: false });
  if (emails.length === 0) {
    invoicesQuery = invoicesQuery.eq("client_email", "");
  } else if (emails.length === 1) {
    invoicesQuery = invoicesQuery.eq("client_email", emails[0]);
  } else {
    invoicesQuery = invoicesQuery.in("client_email", emails);
  }

  const { data: invoices } = await invoicesQuery;
  const clientInvoices = invoices ?? [];
  const totalBilled = clientInvoices.reduce((s: number, i: any) => s + parseFloat(i.total_amount ?? 0), 0);
  const totalPaid = clientInvoices.reduce((s: number, i: any) => s + parseFloat(i.paid_amount ?? 0), 0);

  return NextResponse.json({
    ...client,
    invoices: clientInvoices,
    totalBilled,
    totalPaid,
    outstanding: totalBilled - totalPaid,
    entityEmails: emails,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const { name, commercialName, llcName, email, company, phone, country, sinpeNumber, notes, preferredLanguage, contactPerson, additionalEmails } = body;
  const displayName = commercialName || name;

  const { data, error } = await db.from("clients").update({
    name: displayName,
    commercial_name: commercialName || name,
    llc_name: llcName,
    email, company: company || llcName, phone, country,
    sinpe_number: sinpeNumber, notes,
    preferred_language: preferredLanguage,
    contact_person: contactPerson,
    additional_emails: additionalEmails ?? [],
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await db.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
