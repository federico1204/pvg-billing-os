"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { fmt, BILLING_STATUSES, STATUS_LABELS, BillingStatus } from "@/lib/utils";
import { ArrowLeft, Send, AlertCircle, DollarSign, Clock, Activity } from "lucide-react";

interface InvoiceDetail {
  id: number; invoiceRef: string; clientName: string; clientEmail: string | null; clientCompany: string | null;
  projectName: string | null; totalAmount: number; paidAmount: number; balanceRemaining: number;
  currency: string; dueDate: string; billingStatus: string; daysOverdue: number;
  sentAt: string | null; followUpCount: number; notes: string | null; sinpeNumber: string | null;
  lineItems: any[]; payments: any[]; activities: any[];
}

const MANUAL_STATUSES: BillingStatus[] = ["DRAFT","SENT","CLIENT_REPLIED","PROOF_RECEIVED","WAITING_BANK","DISPUTED","CANCELLED"];

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", reference: "", sendEmail: false });
  const [newStatus, setNewStatus] = useState<BillingStatus>("SENT");

  async function load() {
    const res = await fetch(`/api/invoices/${id}`);
    if (res.ok) setInv(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function sendEmail(type: "invoice" | "followup") {
    setActing(type);
    await fetch(`/api/invoices/${id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    await load();
    setActing(null);
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setActing("pay");
    await fetch(`/api/invoices/${id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount) }),
    });
    setShowPay(false);
    setPayForm({ amount: "", method: "bank_transfer", reference: "", sendEmail: false });
    await load();
    setActing(null);
  }

  async function updateStatus() {
    setActing("status");
    await fetch(`/api/invoices/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingStatus: newStatus }),
    });
    setShowStatus(false);
    await load();
    setActing(null);
  }

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;
  if (!inv) return <div className="p-8 text-zinc-500">Invoice not found</div>;

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Invoices
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{inv.invoiceRef}</h1>
            <StatusBadge status={inv.billingStatus} />
          </div>
          <p className="text-zinc-400 text-sm mt-1">{inv.clientName}{inv.clientCompany ? ` · ${inv.clientCompany}` : ""}</p>
          {inv.projectName && <p className="text-zinc-500 text-xs mt-0.5">{inv.projectName}</p>}
        </div>
        <div className="flex gap-2">
          {inv.billingStatus === "DRAFT" && (
            <Button size="sm" onClick={() => sendEmail("invoice")} disabled={!!acting}>
              <Send size={14} />{acting === "invoice" ? "Sending..." : "Send Invoice"}
            </Button>
          )}
          {["SENT","DUE_SOON","DUE_TODAY","OVERDUE"].includes(inv.billingStatus) && (
            <Button size="sm" variant="outline" onClick={() => sendEmail("followup")} disabled={!!acting}>
              <AlertCircle size={14} />{acting === "followup" ? "Sending..." : "Follow-up"}
            </Button>
          )}
          {!["PAID","CANCELLED"].includes(inv.billingStatus) && (
            <Button size="sm" variant="success" onClick={() => setShowPay(true)}>
              <DollarSign size={14} />Record Payment
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setNewStatus(inv.billingStatus as BillingStatus); setShowStatus(true); }}>
            <Clock size={14} />Status
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs text-zinc-400">Total Amount</p>
          <p className="text-xl font-bold text-white mt-1">{fmt(inv.totalAmount, inv.currency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Balance Remaining</p>
          <p className={`text-xl font-bold mt-1 ${inv.balanceRemaining > 0 ? "text-red-400" : "text-green-400"}`}>{fmt(inv.balanceRemaining, inv.currency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Due Date</p>
          <p className="text-xl font-bold text-white mt-1">{new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          {inv.daysOverdue > 0 && <p className="text-xs text-red-400 mt-1">{inv.daysOverdue} days overdue</p>}
        </Card>
      </div>

      {inv.lineItems && inv.lineItems.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-white mb-4">Line Items</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left pb-2 text-zinc-400 font-medium">Category</th>
                <th className="text-left pb-2 text-zinc-400 font-medium">Description</th>
                <th className="text-right pb-2 text-zinc-400 font-medium">Qty</th>
                <th className="text-right pb-2 text-zinc-400 font-medium">Rate</th>
                <th className="text-right pb-2 text-zinc-400 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lineItems.map((line: any, i: number) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td className="py-2 text-xs text-zinc-400">{line.category || "—"}</td>
                  <td className="py-2 text-zinc-300">{line.description || "—"}</td>
                  <td className="py-2 text-right text-zinc-400">{line.quantity}</td>
                  <td className="py-2 text-right text-zinc-400">{fmt(line.rate, inv.currency)}</td>
                  <td className="py-2 text-right text-zinc-300 font-medium">{fmt(line.amount, inv.currency)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="pt-3 text-right text-sm font-medium text-zinc-400">Total</td>
                <td className="pt-3 text-right text-sm font-bold text-white">{fmt(inv.totalAmount, inv.currency)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Invoice Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Client Email</span><span className="text-zinc-300">{inv.clientEmail || "—"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Currency</span><span className="text-zinc-300">{inv.currency}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Sent At</span><span className="text-zinc-300">{inv.sentAt ? new Date(inv.sentAt).toLocaleDateString() : "Not sent"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Follow-ups</span><span className="text-zinc-300">{inv.followUpCount}</span></div>
            {inv.sinpeNumber && <div className="flex justify-between"><span className="text-zinc-400">SINPE</span><span className="text-zinc-300">{inv.sinpeNumber}</span></div>}
            {inv.notes && <div className="pt-2 border-t border-zinc-800"><p className="text-zinc-400 text-xs mb-1">Notes</p><p className="text-zinc-300 text-xs">{inv.notes}</p></div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Payments</h2>
          {inv.payments.length === 0 ? (
            <p className="text-zinc-500 text-sm">No payments recorded</p>
          ) : (
            <div className="space-y-2">
              {inv.payments.map((p: any) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <div>
                    <p className="text-zinc-300">{fmt(parseFloat(p.amount), inv.currency)}</p>
                    <p className="text-xs text-zinc-500">{p.method} · {new Date(p.paidAt).toLocaleDateString()}</p>
                  </div>
                  {p.reference && <p className="text-xs text-zinc-500">{p.reference}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-zinc-400" />
          <h2 className="text-sm font-medium text-white">Activity Log</h2>
        </div>
        {inv.activities.length === 0 ? (
          <p className="text-zinc-500 text-sm">No activity recorded</p>
        ) : (
          <div className="space-y-3">
            {inv.activities.map((a: any) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-1.5 shrink-0" />
                <div>
                  <p className="text-zinc-300">{a.description}</p>
                  <p className="text-xs text-zinc-500">{new Date(a.createdAt).toLocaleString()} · {a.performedBy}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showPay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Record Payment</h2>
              <button onClick={() => setShowPay(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={recordPayment} className="p-6 space-y-4">
              <div>
                <Label>Amount *</Label>
                <Input type="number" step="0.01" min="0" max={inv.balanceRemaining} value={payForm.amount} onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder={`Max ${fmt(inv.balanceRemaining, inv.currency)}`} required />
              </div>
              <div>
                <Label>Method</Label>
                <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={payForm.method} onChange={(e) => setPayForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="sinpe">SINPE Móvil</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <Label>Reference</Label>
                <Input value={payForm.reference} onChange={(e) => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="Transaction ID or note" />
              </div>
              {inv.clientEmail && (
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={payForm.sendEmail} onChange={(e) => setPayForm(f => ({ ...f, sendEmail: e.target.checked }))} />
                  Send confirmation email to client
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={acting === "pay"} className="flex-1">{acting === "pay" ? "Recording..." : "Record Payment"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowPay(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStatus && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Update Status</h2>
              <button onClick={() => setShowStatus(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label>New Status</Label>
                <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={newStatus} onChange={(e) => setNewStatus(e.target.value as BillingStatus)}>
                  {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <Button onClick={updateStatus} disabled={acting === "status"} className="flex-1">{acting === "status" ? "Updating..." : "Update"}</Button>
                <Button variant="outline" onClick={() => setShowStatus(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
