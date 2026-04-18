import { db } from "@/lib/db";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { computeBillingStatus, daysOverdue, fmt } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data: allInvoices } = await db.from("invoices").select("*");
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
          <CardValue className="text-red-400">{fmt(totalOutstanding)}</CardValue>
          <p className="text-xs text-zinc-500 mt-1">{outstanding.length} open invoice{outstanding.length !== 1 ? "s" : ""}</p>
        </Card>
        <Card>
          <CardTitle>Overdue</CardTitle>
          <CardValue className="text-orange-400">{fmt(totalOverdue)}</CardValue>
          <p className="text-xs text-zinc-500 mt-1">{overdueCount} invoice{overdueCount !== 1 ? "s" : ""}</p>
        </Card>
        <Card>
          <CardTitle>Collected This Month</CardTitle>
          <CardValue className="text-green-400">{fmt(paidThisMonth)}</CardValue>
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
    </div>
  );
}
