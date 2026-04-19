"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/utils";
import { Users, DollarSign, Plus, Pencil, X, Check } from "lucide-react";

interface TeamMember {
  id: number;
  person_name: string;
  role: string;
  monthly_cost: number;
  currency: string;
  sinpe_number: string | null;
  iban: string | null;
  payment_method_preferred: string;
  notes: string | null;
  is_active: boolean;
  ytdPaid: number;
  thisMonthPaid: number;
  lastPayment: { payment_date: string; amount: number; currency: string; payment_method: string } | null;
  paymentCount: number;
}

interface Payment {
  id: number;
  person_name: string;
  team_member_id: number | null;
  payment_date: string;
  amount: number;
  currency: string;
  payment_method: string;
  reference_number: string | null;
  period_month: number;
  period_year: number;
  payment_type: string;
  notes: string | null;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const METHOD_LABELS: Record<string, string> = { SINPE: "SINPE Móvil", TEF: "TEF", bank_transfer: "Bank Transfer", cash: "Cash", other: "Other" };
const TYPE_LABELS: Record<string, string> = { salary: "Salary", bonus: "Bonus", project_payment: "Project", expense_reimbursement: "Reimbursement", advance: "Advance" };

const emptyPayForm = {
  teamMemberId: "",
  personName: "",
  paymentDate: new Date().toISOString().split("T")[0],
  amount: "",
  currency: "USD",
  paymentMethod: "SINPE",
  referenceNumber: "",
  periodMonth: new Date().getMonth() + 1,
  periodYear: new Date().getFullYear(),
  paymentType: "salary",
  notes: "",
  alsoLogAsExpense: true,
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState(emptyPayForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCost, setEditCost] = useState("");
  const [filterMember, setFilterMember] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");

  async function load() {
    setLoading(true);
    const [mRes, pRes] = await Promise.all([fetch("/api/team"), fetch("/api/team/payments")]);
    const [mData, pData] = await Promise.all([mRes.json(), pRes.json()]);
    setMembers(mData);
    setPayments(pData);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Summary stats
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const totalPaidThisMonth = payments
    .filter(p => p.period_month === currentMonth && p.period_year === currentYear && p.currency === "USD")
    .reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const totalPaidYTD = payments
    .filter(p => p.period_year === currentYear && p.currency === "USD")
    .reduce((s, p) => s + parseFloat(String(p.amount)), 0);

  async function saveMonthlyCost(id: number) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyCost: parseFloat(editCost) }),
    });
    setEditingId(null);
    load();
  }

  async function logPayment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const member = members.find(m => m.id === parseInt(payForm.teamMemberId));
    await fetch("/api/team/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payForm,
        teamMemberId: payForm.teamMemberId ? parseInt(payForm.teamMemberId) : null,
        personName: member?.person_name || payForm.personName,
        amount: parseFloat(payForm.amount),
        periodMonth: parseInt(String(payForm.periodMonth)),
        periodYear: parseInt(String(payForm.periodYear)),
      }),
    });
    setShowPayForm(false);
    setPayForm(emptyPayForm);
    setSubmitting(false);
    load();
  }

  function openPayFormFor(member: TeamMember) {
    setPayForm({
      ...emptyPayForm,
      teamMemberId: String(member.id),
      personName: member.person_name,
      amount: member.monthly_cost ? String(member.monthly_cost) : "",
      currency: member.currency,
      paymentMethod: member.payment_method_preferred || "SINPE",
    });
    setShowPayForm(true);
  }

  // Filter payments
  const filteredPayments = payments.filter(p => {
    if (filterMember !== "all" && p.team_member_id !== parseInt(filterMember)) return false;
    if (filterMonth !== "all") {
      const [y, m] = filterMonth.split("-");
      if (p.period_year !== parseInt(y) || p.period_month !== parseInt(m)) return false;
    }
    return true;
  });

  const availableMonths = Array.from(new Set(
    payments.map(p => `${p.period_year}-${String(p.period_month).padStart(2, "0")}`)
  )).sort().reverse();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Payments</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{members.filter(m => m.is_active).length} active team members</p>
        </div>
        <Button onClick={() => setShowPayForm(true)}><Plus size={16} />Log Payment</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-zinc-400" /><p className="text-xs text-zinc-400">Team Size</p></div>
          <p className="text-2xl font-bold text-white">{members.filter(m => m.is_active).length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-zinc-400" /><p className="text-xs text-zinc-400">Paid This Month (USD)</p></div>
          <p className="text-2xl font-bold text-white">{fmt(totalPaidThisMonth)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-zinc-400" /><p className="text-xs text-zinc-400">Paid YTD (USD)</p></div>
          <p className="text-2xl font-bold text-white">{fmt(totalPaidYTD)}</p>
        </div>
      </div>

      {/* Team member cards */}
      <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Team Members</h2>
      {loading ? (
        <div className="text-zinc-500 py-8 text-center">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-10">
          {members.filter(m => m.is_active).map(m => (
            <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-medium text-sm">{m.person_name}</p>
                  <p className="text-zinc-500 text-xs">{m.role}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openPayFormFor(m)}>
                  <Plus size={12} />Log Payment
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-xs text-zinc-500 mb-0.5">Monthly Rate</p>
                  {editingId === m.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editCost}
                        onChange={e => setEditCost(e.target.value)}
                        className="h-6 text-xs px-1.5 w-24"
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") saveMonthlyCost(m.id); if (e.key === "Escape") setEditingId(null); }}
                      />
                      <button onClick={() => saveMonthlyCost(m.id)} className="text-green-400 hover:text-green-300"><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-white"><X size={12} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(m.id); setEditCost(String(m.monthly_cost || "")); }}
                      className="text-sm font-semibold text-white hover:text-green-400 transition-colors flex items-center gap-1 group"
                    >
                      {m.monthly_cost ? fmt(m.monthly_cost, m.currency) : <span className="text-zinc-600">Set amount</span>}
                      <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-0.5">This Month</p>
                  <p className="text-sm font-semibold text-white">{m.thisMonthPaid > 0 ? fmt(m.thisMonthPaid, m.currency) : <span className="text-zinc-600">—</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-0.5">YTD</p>
                  <p className="text-sm font-semibold text-white">{m.ytdPaid > 0 ? fmt(m.ytdPaid, m.currency) : <span className="text-zinc-600">—</span>}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  {m.sinpe_number && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                      SINPE {m.sinpe_number}
                    </span>
                  )}
                  {m.payment_method_preferred && !m.sinpe_number && (
                    <span className="text-xs text-zinc-600">{METHOD_LABELS[m.payment_method_preferred] ?? m.payment_method_preferred}</span>
                  )}
                </div>
                {m.lastPayment && (
                  <p className="text-xs text-zinc-600">
                    Last: {new Date(m.lastPayment.payment_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmt(m.lastPayment.amount, m.lastPayment.currency)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment log */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Payment Log</h2>
        <div className="flex gap-2">
          <select
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            value={filterMember}
            onChange={e => setFilterMember(e.target.value)}
          >
            <option value="all">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.person_name}</option>)}
          </select>
          <select
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          >
            <option value="all">All Months</option>
            {availableMonths.map(m => {
              const [y, mo] = m.split("-");
              return <option key={m} value={m}>{MONTHS[parseInt(mo) - 1]} {y}</option>;
            })}
          </select>
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="border border-dashed border-zinc-700 rounded-xl py-12 text-center">
          <p className="text-zinc-500 text-sm">No payments logged yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Click "Log Payment" to record a team payment.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Date</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Person</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Period</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Type</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Method · Ref</th>
                <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-xs">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">
                    {new Date(p.payment_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5 text-white text-sm font-medium">{p.person_name}</td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">{MONTHS[p.period_month - 1]} {p.period_year}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      {TYPE_LABELS[p.payment_type] ?? p.payment_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">
                    {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    {p.reference_number && <span className="ml-1 font-mono text-zinc-600">· {p.reference_number}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">
                    {fmt(parseFloat(String(p.amount)), p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Payment modal */}
      {showPayForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Log Team Payment</h2>
              <button onClick={() => setShowPayForm(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={logPayment} className="p-6 space-y-4">
              <div>
                <Label>Team Member</Label>
                <select
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={payForm.teamMemberId}
                  onChange={e => {
                    const m = members.find(m => m.id === parseInt(e.target.value));
                    setPayForm(f => ({
                      ...f,
                      teamMemberId: e.target.value,
                      personName: m?.person_name || "",
                      amount: m?.monthly_cost ? String(m.monthly_cost) : f.amount,
                      paymentMethod: m?.payment_method_preferred || "SINPE",
                      currency: m?.currency || "USD",
                    }));
                  }}
                  required
                >
                  <option value="">Select team member…</option>
                  {members.filter(m => m.is_active).map(m => (
                    <option key={m.id} value={m.id}>{m.person_name} — {m.role}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={payForm.amount}
                    onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={payForm.currency}
                    onChange={e => setPayForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="USD">USD</option>
                    <option value="CRC">CRC ₡</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Date *</Label>
                  <Input type="date" value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} required />
                </div>
                <div>
                  <Label>Payment Type</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={payForm.paymentType}
                    onChange={e => setPayForm(f => ({ ...f, paymentType: e.target.value }))}
                  >
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Period Month</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={payForm.periodMonth}
                    onChange={e => setPayForm(f => ({ ...f, periodMonth: parseInt(e.target.value) }))}
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Period Year</Label>
                  <Input type="number" value={payForm.periodYear} onChange={e => setPayForm(f => ({ ...f, periodYear: parseInt(e.target.value) }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Method</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={payForm.paymentMethod}
                    onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Reference / Confirmation #</Label>
                  <Input
                    placeholder="SINPE conf. or TEF ref."
                    value={payForm.referenceNumber}
                    onChange={e => setPayForm(f => ({ ...f, referenceNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  placeholder="Optional note about this payment"
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="logExpense"
                  checked={payForm.alsoLogAsExpense}
                  onChange={e => setPayForm(f => ({ ...f, alsoLogAsExpense: e.target.checked }))}
                  className="rounded border-zinc-700"
                />
                <Label htmlFor="logExpense" className="cursor-pointer">
                  Also log as expense <span className="text-zinc-500 font-normal">(Payroll & Salaries category)</span>
                </Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving…" : "Log Payment"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowPayForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
