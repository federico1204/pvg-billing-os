import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db
    .from("financial_snapshots")
    .select("id, snapshot_date, report_json, total_outstanding_usd, total_overdue_usd, collected_this_month_usd, net_cash_position_usd, open_invoice_count, overdue_invoice_count")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return NextResponse.json(null);

  return NextResponse.json({
    id: data.id,
    snapshot_date: data.snapshot_date,
    health_score: data.report_json?.health_score ?? null,
    report_json: data.report_json,
  });
}
