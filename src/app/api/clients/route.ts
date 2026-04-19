import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db.from("clients").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with invoice stats
  const { data: invoices } = await db.from("invoices").select("client_email, total_amount, paid_amount, status, due_date, created_at");
  const allClients = data ?? [];

  // Build map: commercial_name → [email, ...] for sibling aggregation
  const nameToEmails: Record<string, string[]> = {};
  for (const c of allClients) {
    const key = c.commercial_name || c.name;
    if (c.email) {
      if (!nameToEmails[key]) nameToEmails[key] = [];
      if (!nameToEmails[key].includes(c.email)) nameToEmails[key].push(c.email);
    }
  }

  // Track which client IDs are "sub-entities" (same commercial_name but not the canonical record)
  // The canonical record is the one with the lowest id for that commercial_name
  const canonicalId: Record<string, number> = {};
  for (const c of allClients) {
    const key = c.commercial_name || c.name;
    if (canonicalId[key] === undefined || c.id < canonicalId[key]) canonicalId[key] = c.id;
  }

  const clientList = allClients.map((c: any) => {
    const key = c.commercial_name || c.name;
    const siblingEmails = nameToEmails[key] ?? (c.email ? [c.email] : []);
    const clientInvoices = (invoices ?? []).filter((i: any) => siblingEmails.includes(i.client_email));
    const totalBilled = clientInvoices.reduce((s: number, i: any) => s + parseFloat(i.total_amount ?? 0), 0);
    const totalPaid = clientInvoices.reduce((s: number, i: any) => s + parseFloat(i.paid_amount ?? 0), 0);
    const isSubEntity = canonicalId[key] !== c.id;
    return { ...c, totalBilled, totalPaid, outstanding: totalBilled - totalPaid, invoiceCount: clientInvoices.length, isSubEntity, siblingCount: siblingEmails.length };
  });

  return NextResponse.json(clientList);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, commercialName, llcName, email, company, phone, country, sinpeNumber, notes, preferredLanguage } = body;
  const displayName = commercialName || name;
  if (!displayName) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Auto-generate client_ref: find the highest existing numeric suffix
  const { data: existing } = await db.from("clients").select("client_ref").order("id", { ascending: false }).limit(1).maybeSingle();
  let nextNum = 1;
  if (existing?.client_ref) {
    const match = existing.client_ref.match(/PVG-CLI-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const clientRef = `PVG-CLI-${String(nextNum).padStart(3, "0")}`;

  const { data, error } = await db.from("clients").insert({
    name: displayName,
    commercial_name: commercialName || name,
    llc_name: llcName,
    client_ref: clientRef,
    email, company: company || llcName, phone, country: country || "Costa Rica",
    sinpe_number: sinpeNumber, notes,
    preferred_language: preferredLanguage || "en",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
