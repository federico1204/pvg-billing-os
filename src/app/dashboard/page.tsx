import { db } from "@/lib/db";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { computeBillingStatus, daysOverdue, fmt } from "@/lib/utils";
import { PrivateValue } from "@/components/private-value";
import Link from "next/link";
import { Brain, TrendingUp, AlertTriangle, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data: allInvoices } = await db.from("invoices").select("*");

  // Latest intelligence snapshot
  const { data: latestSnap } = await db
    .from("financial_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const invoices = allInvoices ?? [];

  const enriched = invoices.map((inv: any) => {
    const total = parseFloat(inv.total_amount);
    const paid = parseFloat(inv.paid_amount ?? "0");
    const overdue = daysOverdue(inv.due_date);
    const billing = computeBillingStatus(inv.billing_status ?? "DRAFT", inv.status ?? "pending", inv.due_date, paid, total);
    return { ...inv, total, paid, overdue, billing, balance: Math.max(0, total - paid) };
  });

  const outstanding = enriched.filter((i) => i.billing !== "PAID" && i.billing !== "CANCELLED");
  const totalOutstanding = outstanding.reduce((s, i) => s + i.balance, 0);
  const totalOverdue = outstanding.filter((i) => i.overdue > 0).reduce((s, i) => s + i.balance, 0);
  const overdueCount = outstanding.filter((i) => i.overdue > 0).length;
  const paidThisMonth = invoices
    .filter((i: any) => i.status === "paid" && i.updated_at && new Date(i.updated_at).getMonth() === new Date().getMonth())
    .reduce((s: number, i: any) => s + parseFloat(i.paid_amount ?? "0"), 0);

  const urgent = outstanding.filter((i) => i.overdue > 0 || i.billing === "DRAFT" || i.billing === "DUE_TODAY").slice(0, 5);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Billing Overview</h1>
        <p className="text-zinc-400 text-sm mt-1">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card>
          <CardTitle>Total Outstanding</CardTitle>
          <CardValue><PrivateValue value={fmt(totalOutstanding)} className="text-red-400" /></CardValue>
          <p className="text-xs text-zinc-500 mt-1">{outstanding.length} open invoice{outstanding.length !== 1 ? "s" : ""}</p>
        </Card>
        <Card>
          <CardTitle>Overdue</CardTitle>
          <CardValue><PrivateValue value={fmt(totalOverdue)} className="text-orange-400" /></CardValue>
          <p className="text-xs text-zinc-500 mt-1">{overdueCount} invoice{overdueCount !== 1 ? "s" : ""}</p>
        </Card>
        <Card>
          <CardTitle>Collected This Month</CardTitle>
          <CardValue><PrivateValue value={fmt(paidThisMonth)} className="text-green-400" /></CardValue>
        </Card>
        <Card>
          <CardTitle>Total Invoices</CardTitle>
          <CardValue>{invoices.length}</CardValue>
        </Card>
      </div>

      {urgent.length > 0 && (
        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Needs Attention</h2>
          <div className="space-y-3">
            {urgent.map((inv) => (
              <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{inv.invoice_ref}</span>
                    <StatusBadge status={inv.billing} />
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{inv.client_name}{inv.client_company ? ` · ${inv.client_company}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{fmt(inv.balance, inv.currency ?? "USD")}</p>
                  {inv.overdue > 0 && <p className="text-xs text-red-400">{inv.overdue}d overdue</p>}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/dashboard/invoices" className="text-xs text-green-400 hover:text-green-300">View all invoices →</Link>
          </div>
        </Card>
      )}

      {invoices.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-zinc-400 mb-4">No invoices yet.</p>
          <Link href="/dashboard/invoices" className="text-green-400 hover:text-green-300 text-sm">Create your first invoice →</Link>
        </Card>
      )}

      {/* Financial Health Card */}
      <div className="mt-6">
        {latestSnap && latestSnap.report_json ? (() => {
          const report = latestSnap.report_json as any;
          const score = report.health_score ?? 0;
          const scoreColor = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : score >= 25 ? "text-orange-400" : "text-red-400";
          const borderColor = score >= 75 ? "border-green-800" : score >= 50 ? "border-yellow-800" : score >= 25 ? "border-orange-800" : "border-red-800";
          const priority = report.this_week_priorities?.[0];
          const firstRisk = report.risk_flags?.[0];
          const firstOpp = report.revenue_opportunities?.[0];
          const analyzedDate = new Date(latestSnap.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <div className={`bg-zinc-900 border ${borderColor} rounded-xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white">Financial Health</h2>
                  <span className="text-xs text-zinc-500">· analyzed {analyzedDate}</span>
                </div>
                <Link href="/dashboard/intelligence" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Full Analysis →
                </Link>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className={`text-3xl font-bold ${scoreColor}`}>{score}<span className="text-base text-zinc-500 font-normal">/100</span></div>
                <span className={`text-sm font-medium ${scoreColor}`}>{report.health_label}</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{report.executive_summary}</p>
              <div className="space-y-1.5">
                {priority && (
                  <div className="flex items-start gap-2 text-xs">
                    <Zap size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                    <span className="text-zinc-300">{priority}</span>
                  </div>
                )}
                {firstOpp && (
                  <div className="flex items-start gap-2 text-xs">
                    <TrendingUp size={12} className="text-green-400 mt-0.5 shrink-0" />
                    <span className="text-zinc-300">{firstOpp.client}: {firstOpp.opportunity}</span>
                  </div>
                )}
                {firstRisk && (
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                    <span className="text-zinc-300">{firstRisk.client}: {firstRisk.description}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })() : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain size={16} className="text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-white">Financial Intelligence</p>
                <p className="text-xs text-zinc-500">No analysis run yet — get AI-powered financial insights</p>
              </div>
            </div>
            <Link href="/dashboard/intelligence" className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">
              Run Analysis →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
