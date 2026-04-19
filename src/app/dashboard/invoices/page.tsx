"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt, BILLING_STATUSES, STATUS_LABELS, BillingStatus } from "@/lib/utils";
import { Plus, Search, RefreshCw, SendHorizonal, Trash2 } from "lucide-react";

// QuickBooks-style service categories for a marketing agency
const SERVICE_CATEGORIES = [
  "Social Media Management",
  "SEO & Content Marketing",
  "Paid Advertising (Google / Meta)",
  "Web Design & Development",
  "Email Marketing",
  "Brand Strategy & Consulting",
  "Monthly Retainer",
  "One-time Project Fee",
  "Account Management",
  "Analytics & Reporting",
  "Creative Production",
  "Credit Note / Adjustment",
  "Other",
];

interface LineItem {
  description: string;
  category: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: number;
  invoiceRef: string;
  clientName: string;
  clientCompany: string | null;
  projectName: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceRemaining: number;
  currency: string;
  dueDate: string;
  billingStatus: string;
  daysOverdue: number;
  sentAt: string | null;
  followUpCount: number;
}

const blankLine = (): LineItem => ({ description: "", category: "", quantity: 1, rate: 0, amount: 0 });

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    clientName: "", clientEmail: "", clientCompany: "", projectName: "",
    totalAmount: "", currency: "USD", invoiceType: "standard",
    dueDate: "", sinpeNumber: "", notes: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([blankLine()]);
  const [useLineItems, setUseLineItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingFollowUps, setSendingFollowUps] = useState(false);
  const [followUpResult, setFollowUpResult] = useState<{ sent: string[]; total: number } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/invoices");
    const data = await res.json();
    setInvoices(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = invoices.filter((inv) => {
    const matchSearch = search === "" || inv.invoiceRef.toLowerCase().includes(search.toLowerCase()) || inv.clientName.toLowerCase().includes(search.toLowerCase()) || (inv.projectName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.billingStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "quantity" || field === "rate") {
        next[i].amount = Number(next[i].quantity) * Number(next[i].rate);
      }
      return next;
    });
  }

  const lineTotal = lineItems.reduce((s, l) => s + l.amount, 0);

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const total = useLineItems ? lineTotal : parseFloat(newForm.totalAmount);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newForm,
        totalAmount: total,
        lineItems: useLineItems ? lineItems : [],
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setShowNew(false);
      setNewForm({ clientName: "", clientEmail: "", clientCompany: "", projectName: "", totalAmount: "", currency: "USD", invoiceType: "standard", dueDate: "", sinpeNumber: "", notes: "" });
      setLineItems([blankLine()]);
      setUseLineItems(false);
      router.push(`/dashboard/invoices/${created.id}`);
    }
    setSubmitting(false);
  }

  async function sendBatchFollowUps() {
    setSendingFollowUps(true);
    setFollowUpResult(null);
    const res = await fetch("/api/invoices/follow-ups", { method: "POST" });
    const data = await res.json();
    setFollowUpResult(data);
    setSendingFollowUps(false);
    if (data.total > 0) await load();
  }

  const needsFollowUp = invoices.filter(i => ["SENT", "DUE_SOON", "DUE_TODAY", "OVERDUE"].includes(i.billingStatus) && i.billingStatus !== "PAID").length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{invoices.length} total · {invoices.filter(i => i.billingStatus !== "PAID" && i.billingStatus !== "CANCELLED").length} open</p>
        </div>
        <div className="flex gap-2">
          {needsFollowUp > 0 && (
            <Button variant="outline" size="sm" onClick={sendBatchFollowUps} disabled={sendingFollowUps}>
              <SendHorizonal size={14} />
              {sendingFollowUps ? "Sending..." : `Send Follow-ups (${needsFollowUp})`}
            </Button>
          )}
          <Button onClick={() => setShowNew(true)}><Plus size={16} />New Invoice</Button>
        </div>
      </div>

      {followUpResult && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-sm text-green-300">
          Sent {followUpResult.total} follow-up{followUpResult.total !== 1 ? "s" : ""}: {followUpResult.sent.join(", ")}
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input className="pl-8" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {BILLING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={load}><RefreshCw size={14} /></Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">Loading...</div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Client</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Project</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Amount</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Balance</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-zinc-500">No invoices found</td></tr>
              ) : filtered.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                  className="border-b border-zinc-800 hover:bg-zinc-900 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">{inv.invoiceRef}</td>
                  <td className="px-4 py-3">
                    <p className="text-white">{inv.clientName}</p>
                    {inv.clientCompany && <p className="text-xs text-zinc-500">{inv.clientCompany}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{inv.projectName || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.billingStatus} /></td>
                  <td className="px-4 py-3 text-right text-zinc-300">{fmt(inv.totalAmount, inv.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={inv.balanceRemaining > 0 ? "text-red-400" : "text-green-400"}>
                      {fmt(inv.balanceRemaining, inv.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 text-xs">
                    <div>{inv.dueDate ? new Date(inv.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div>
                    {inv.daysOverdue > 0 && <div className="text-red-400">{inv.daysOverdue}d late</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">New Invoice</h2>
              <button onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={createInvoice} className="p-6 space-y-5">
              {/* Client Info */}
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Client</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Client Name *</Label>
                    <Input value={newForm.clientName} onChange={(e) => setNewForm(f => ({ ...f, clientName: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Client Email</Label>
                    <Input type="email" value={newForm.clientEmail} onChange={(e) => setNewForm(f => ({ ...f, clientEmail: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input value={newForm.clientCompany} onChange={(e) => setNewForm(f => ({ ...f, clientCompany: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label>Project Name</Label>
                    <Input value={newForm.projectName} onChange={(e) => setNewForm(f => ({ ...f, projectName: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Invoice Settings */}
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Invoice</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Currency</Label>
                    <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={newForm.currency} onChange={(e) => setNewForm(f => ({ ...f, currency: e.target.value }))}>
                      <option value="USD">USD</option>
                      <option value="CRC">CRC (₡)</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={newForm.invoiceType} onChange={(e) => setNewForm(f => ({ ...f, invoiceType: e.target.value }))}>
                      <option value="standard">Standard</option>
                      <option value="cr_iva">CR IVA (13%)</option>
                      <option value="credit_note">Credit Note</option>
                    </select>
                  </div>
                  <div>
                    <Label>Due Date *</Label>
                    <Input type="date" value={newForm.dueDate} onChange={(e) => setNewForm(f => ({ ...f, dueDate: e.target.value }))} required />
                  </div>
                </div>
                {(newForm.currency === "CRC" || newForm.invoiceType === "cr_iva") && (
                  <div className="mt-3">
                    <Label>SINPE Móvil</Label>
                    <Input placeholder="8888-8888" value={newForm.sinpeNumber} onChange={(e) => setNewForm(f => ({ ...f, sinpeNumber: e.target.value }))} />
                  </div>
                )}
              </div>

              {/* Line Items Toggle */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={useLineItems} onChange={(e) => setUseLineItems(e.target.checked)} className="rounded" />
                  <span className="text-sm text-zinc-300">Use line items (QuickBooks-style)</span>
                </label>

                {useLineItems ? (
                  <div>
                    <div className="space-y-2 mb-2">
                      {lineItems.map((line, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4">
                            <select
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              value={line.category}
                              onChange={(e) => updateLine(i, "category", e.target.value)}
                            >
                              <option value="">Category...</option>
                              {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <Input className="text-xs py-1.5" placeholder="Description" value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} />
                          </div>
                          <div className="col-span-1">
                            <Input className="text-xs py-1.5" type="number" min="1" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 1)} />
                          </div>
                          <div className="col-span-2">
                            <Input className="text-xs py-1.5" type="number" step="0.01" placeholder="Rate" value={line.rate || ""} onChange={(e) => updateLine(i, "rate", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div className="col-span-1 text-right text-xs text-zinc-300">{fmt(line.amount, newForm.currency)}</div>
                          <div className="col-span-1 text-right">
                            {lineItems.length > 1 && (
                              <button type="button" onClick={() => setLineItems(prev => prev.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <button type="button" onClick={() => setLineItems(prev => [...prev, blankLine()])} className="text-xs text-green-400 hover:text-green-300">+ Add line</button>
                      <p className="text-sm font-medium text-white">Total: {fmt(lineTotal, newForm.currency)}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Amount *</Label>
                    <Input type="number" step="0.01" min="0" value={newForm.totalAmount} onChange={(e) => setNewForm(f => ({ ...f, totalAmount: e.target.value }))} required={!useLineItems} />
                  </div>
                )}
              </div>

              <div>
                <Label>Notes</Label>
                <textarea className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[70px] resize-y" value={newForm.notes} onChange={(e) => setNewForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Creating..." : "Create Invoice"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
