"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/utils";
import {
  CreditCard, Plus, X, ChevronDown, ChevronUp, Trash2,
  CheckCircle, AlertCircle, Clock, TrendingUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Card {
  id: number;
  name: string;
  bank: string | null;
  last_four: string | null;
  card_type: string;
  credit_limit: number;
  currency: string;
  statement_close_day: number | null;
  payment_due_days: number;
  color: string;
  notes: string | null;
  thisMonthSpend: number;
  ytdSpend: number;
  latestStatement: Statement | null;
  chargeCount: number;
}

interface Charge {
  id: number;
  card_id: number;
  charge_date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string | null;
  description: string | null;
  statement_month: number;
  statement_year: number;
  is_recurring: boolean;
}

interface Statement {
  id: number;
  card_id: number;
  statement_month: number;
  statement_year: number;
  closing_balance: number;
  minimum_payment: number;
  payment_due_date: string | null;
  paid_amount: number;
  paid_date: string | null;
  status: string;
  notes: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CATEGORIES = [
  "Software & Tools","Advertising","Travel","Meals & Entertainment",
  "Office Supplies","Subscriptions","Payroll & Salaries","Other",
];
const CARD_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open:         { label: "Open",      color: "text-zinc-400",   icon: Clock },
  paid_full:    { label: "Paid ✓",    color: "text-green-400",  icon: CheckCircle },
  paid_partial: { label: "Partial",   color: "text-amber-400",  icon: AlertCircle },
  overdue:      { label: "Overdue",   color: "text-red-400",    icon: AlertCircle },
};

const emptyCardForm = {
  name: "", bank: "", lastFour: "", cardType: "visa",
  creditLimit: "", currency: "USD", statementCloseDay: "",
  paymentDueDays: "21", color: "#6366f1", notes: "",
};
const emptyChargeForm = {
  chargeDate: new Date().toISOString().split("T")[0],
  merchant: "", amount: "", currency: "USD",
  category: "", description: "", isRecurring: false,
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreditCardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [charges, setCharges] = useState<Record<number, Charge[]>>({});
  const [statements, setStatements] = useState<Record<number, Statement[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, "charges"|"statements">>({});

  // Modals
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [showAddCharge, setShowAddCharge] = useState<number | null>(null);
  const [chargeForm, setChargeForm] = useState(emptyChargeForm);
  const [showAddStatement, setShowAddStatement] = useState<number | null>(null);
  const [statementForm, setStatementForm] = useState({
    statementMonth: new Date().getMonth() + 1,
    statementYear: new Date().getFullYear(),
    closingBalance: "", minimumPayment: "",
    paymentDueDate: "", paidAmount: "", paidDate: "",
    status: "open", notes: "",
  });

  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/credit-cards");
    const data = await res.json();
    setCards(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function loadCard(cardId: number) {
    const [cRes, sRes] = await Promise.all([
      fetch(`/api/credit-cards/${cardId}/charges`),
      fetch(`/api/credit-cards/${cardId}/statements`),
    ]);
    const [cData, sData] = await Promise.all([cRes.json(), sRes.json()]);
    setCharges(prev => ({ ...prev, [cardId]: cData }));
    setStatements(prev => ({ ...prev, [cardId]: sData }));
  }

  useEffect(() => { load(); }, []);

  function toggleExpand(cardId: number) {
    if (expandedCard === cardId) {
      setExpandedCard(null);
    } else {
      setExpandedCard(cardId);
      if (!charges[cardId]) loadCard(cardId);
      if (!activeTab[cardId]) setActiveTab(prev => ({ ...prev, [cardId]: "charges" }));
    }
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cardForm,
        creditLimit: parseFloat(cardForm.creditLimit) || 0,
        statementCloseDay: cardForm.statementCloseDay ? parseInt(cardForm.statementCloseDay) : null,
        paymentDueDays: parseInt(cardForm.paymentDueDays) || 21,
      }),
    });
    setShowAddCard(false);
    setCardForm(emptyCardForm);
    setSubmitting(false);
    load();
  }

  async function addCharge(e: React.FormEvent, cardId: number) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`/api/credit-cards/${cardId}/charges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...chargeForm, amount: parseFloat(chargeForm.amount) }),
    });
    setShowAddCharge(null);
    setChargeForm(emptyChargeForm);
    setSubmitting(false);
    load();
    loadCard(cardId);
  }

  async function deleteCharge(cardId: number, chargeId: number) {
    await fetch(`/api/credit-cards/${cardId}/charges?chargeId=${chargeId}`, { method: "DELETE" });
    load();
    loadCard(cardId);
  }

  async function addStatement(e: React.FormEvent, cardId: number) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`/api/credit-cards/${cardId}/statements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...statementForm,
        closingBalance: parseFloat(statementForm.closingBalance) || 0,
        minimumPayment: parseFloat(statementForm.minimumPayment) || 0,
        paidAmount: parseFloat(statementForm.paidAmount) || 0,
        paymentDueDate: statementForm.paymentDueDate || null,
        paidDate: statementForm.paidDate || null,
      }),
    });
    setShowAddStatement(null);
    setSubmitting(false);
    load();
    loadCard(cardId);
  }

  // ── Summary totals ──────────────────────────────────────────────────────────
  const totalLimit = cards.reduce((s, c) => s + (c.credit_limit || 0), 0);
  const totalMonthSpend = cards.reduce((s, c) => s + (c.thisMonthSpend || 0), 0);
  const totalOwed = cards.reduce((s, c) => s + (c.latestStatement?.closing_balance || 0) - (c.latestStatement?.paid_amount || 0), 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Credit Cards</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{cards.length} card{cards.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <Button onClick={() => setShowAddCard(true)}><Plus size={16} />Add Card</Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Total Credit Limit</p>
          <p className="text-2xl font-bold text-white">{fmt(totalLimit)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Spent This Month</p>
          <p className="text-2xl font-bold text-white">{fmt(totalMonthSpend)}</p>
        </div>
        <div className={`border-2 rounded-xl p-4 ${totalOwed > 0 ? "border-red-500/40 bg-red-950/20" : "border-zinc-800 bg-zinc-900"}`}>
          <p className="text-xs text-zinc-500 mb-1">Total Balance Owed</p>
          <p className={`text-2xl font-bold ${totalOwed > 0 ? "text-red-400" : "text-white"}`}>{fmt(Math.max(0, totalOwed))}</p>
        </div>
      </div>

      {/* Cards list */}
      {loading ? (
        <div className="text-zinc-500 py-16 text-center">Loading...</div>
      ) : cards.length === 0 ? (
        <div className="border border-dashed border-zinc-700 rounded-xl py-16 text-center">
          <CreditCard size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No credit cards added yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Click "Add Card" to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => {
            const isExpanded = expandedCard === card.id;
            const tab = activeTab[card.id] ?? "charges";
            const cardCharges = charges[card.id] ?? [];
            const cardStatements = statements[card.id] ?? [];
            const stmt = card.latestStatement;
            const owed = Math.max(0, (stmt?.closing_balance ?? 0) - (stmt?.paid_amount ?? 0));
            const utilization = card.credit_limit > 0 ? Math.min(100, (card.thisMonthSpend / card.credit_limit) * 100) : 0;
            const StatusIcon = stmt ? (STATUS_CONFIG[stmt.status]?.icon ?? Clock) : Clock;
            const statusColor = stmt ? (STATUS_CONFIG[stmt.status]?.color ?? "text-zinc-400") : "text-zinc-600";
            const statusLabel = stmt ? (STATUS_CONFIG[stmt.status]?.label ?? stmt.status) : "No statement";

            return (
              <div key={card.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Card header row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                  onClick={() => toggleExpand(card.id)}
                >
                  {/* Card chip */}
                  <div className="w-12 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: card.color }}>
                    <CreditCard size={16} className="text-white/80" />
                  </div>

                  {/* Name + bank */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold text-sm">{card.name}</p>
                      {card.last_four && (
                        <span className="text-zinc-500 text-xs font-mono">·· {card.last_four}</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs">{card.bank ?? "—"}</p>
                  </div>

                  {/* Utilization bar */}
                  {card.credit_limit > 0 && (
                    <div className="w-32 hidden sm:block">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>{fmt(card.thisMonthSpend)}</span>
                        <span>{Math.round(utilization)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${utilization}%`,
                            background: utilization > 80 ? "#ef4444" : utilization > 60 ? "#f59e0b" : card.color,
                          }}
                        />
                      </div>
                      <p className="text-xs text-zinc-600 mt-1">of {fmt(card.credit_limit)} limit</p>
                    </div>
                  )}

                  {/* Statement status */}
                  <div className="text-right min-w-[100px]">
                    <div className={`flex items-center justify-end gap-1 ${statusColor}`}>
                      <StatusIcon size={12} />
                      <span className="text-xs font-medium">{statusLabel}</span>
                    </div>
                    {owed > 0 && (
                      <p className="text-sm font-bold text-red-400 mt-0.5">{fmt(owed)} owed</p>
                    )}
                    {stmt && owed === 0 && (
                      <p className="text-xs text-green-500 mt-0.5">All clear ✓</p>
                    )}
                  </div>

                  {isExpanded ? <ChevronUp size={16} className="text-zinc-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-zinc-500 flex-shrink-0" />}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800">
                    {/* Quick stats */}
                    <div className="grid grid-cols-4 divide-x divide-zinc-800 border-b border-zinc-800">
                      {[
                        { label: "This Month", value: fmt(card.thisMonthSpend) },
                        { label: "YTD Spend", value: fmt(card.ytdSpend) },
                        { label: "Statement Balance", value: stmt ? fmt(stmt.closing_balance) : "—" },
                        { label: "Due", value: stmt?.payment_due_date ? fmtDate(stmt.payment_due_date) : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="p-3 text-center">
                          <p className="text-xs text-zinc-500">{label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-zinc-800">
                      {(["charges", "statements"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setActiveTab(prev => ({ ...prev, [card.id]: t }))}
                          className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors ${
                            tab === t ? "text-white border-b-2 border-[#819800]" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {t === "charges" ? `Charges (${cardCharges.length})` : `Statements (${cardStatements.length})`}
                        </button>
                      ))}
                      <div className="flex-1" />
                      {tab === "charges" && (
                        <button
                          onClick={() => { setShowAddCharge(card.id); setChargeForm(emptyChargeForm); }}
                          className="flex items-center gap-1 px-4 py-2.5 text-xs text-[#819800] hover:text-white transition-colors"
                        >
                          <Plus size={12} />Add Charge
                        </button>
                      )}
                      {tab === "statements" && (
                        <button
                          onClick={() => { setShowAddStatement(card.id); }}
                          className="flex items-center gap-1 px-4 py-2.5 text-xs text-[#819800] hover:text-white transition-colors"
                        >
                          <Plus size={12} />Add Statement
                        </button>
                      )}
                    </div>

                    {/* Charges table */}
                    {tab === "charges" && (
                      cardCharges.length === 0 ? (
                        <div className="py-8 text-center text-zinc-600 text-sm">No charges logged yet.</div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-zinc-900/95">
                              <tr className="border-b border-zinc-800">
                                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Date</th>
                                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Merchant</th>
                                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Category</th>
                                <th className="text-right px-4 py-2.5 text-xs text-zinc-500 font-medium">Amount</th>
                                <th className="px-4 py-2.5 w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {cardCharges.map(charge => (
                                <tr key={charge.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 group">
                                  <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(charge.charge_date)}</td>
                                  <td className="px-4 py-2.5 text-white text-sm">
                                    {charge.merchant}
                                    {charge.is_recurring && <span className="ml-1.5 text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">recurring</span>}
                                    {charge.description && <p className="text-xs text-zinc-600 mt-0.5">{charge.description}</p>}
                                  </td>
                                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{charge.category ?? "—"}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">{fmt(parseFloat(String(charge.amount)), charge.currency)}</td>
                                  <td className="px-4 py-2.5">
                                    <button
                                      onClick={() => deleteCharge(card.id, charge.id)}
                                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {/* Statements table */}
                    {tab === "statements" && (
                      cardStatements.length === 0 ? (
                        <div className="py-8 text-center text-zinc-600 text-sm">No statements logged yet.</div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-zinc-900/95">
                              <tr className="border-b border-zinc-800">
                                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Period</th>
                                <th className="text-right px-4 py-2.5 text-xs text-zinc-500 font-medium">Balance</th>
                                <th className="text-right px-4 py-2.5 text-xs text-zinc-500 font-medium">Min. Payment</th>
                                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Due Date</th>
                                <th className="text-right px-4 py-2.5 text-xs text-zinc-500 font-medium">Paid</th>
                                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cardStatements.map(s => {
                                const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.open;
                                const SIcon = sc.icon;
                                const remaining = Math.max(0, s.closing_balance - s.paid_amount);
                                return (
                                  <tr key={s.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                                    <td className="px-4 py-2.5 text-white font-medium">{MONTHS[s.statement_month - 1]} {s.statement_year}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">{fmt(s.closing_balance)}</td>
                                    <td className="px-4 py-2.5 text-right text-zinc-400 tabular-nums">{s.minimum_payment > 0 ? fmt(s.minimum_payment) : "—"}</td>
                                    <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(s.payment_due_date)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                      {s.paid_amount > 0 ? (
                                        <span className="text-green-400 font-medium">{fmt(s.paid_amount)}</span>
                                      ) : <span className="text-zinc-600">—</span>}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className={`flex items-center gap-1 ${sc.color}`}>
                                        <SIcon size={12} />
                                        <span className="text-xs">{sc.label}</span>
                                        {remaining > 0 && s.status !== "open" && (
                                          <span className="text-xs text-zinc-600 ml-1">({fmt(remaining)} left)</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Card Modal ────────────────────────────────────────────────────── */}
      {showAddCard && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Add Credit Card</h2>
              <button onClick={() => setShowAddCard(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={addCard} className="p-6 space-y-4">
              <div>
                <Label>Card Name *</Label>
                <Input placeholder="e.g. Amex Gold, Visa BAC" value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bank / Issuer</Label>
                  <Input placeholder="BAC, Scotiabank…" value={cardForm.bank} onChange={e => setCardForm(f => ({ ...f, bank: e.target.value }))} />
                </div>
                <div>
                  <Label>Last 4 Digits</Label>
                  <Input placeholder="1234" maxLength={4} value={cardForm.lastFour} onChange={e => setCardForm(f => ({ ...f, lastFour: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Credit Limit</Label>
                  <Input type="number" step="0.01" placeholder="10000" value={cardForm.creditLimit} onChange={e => setCardForm(f => ({ ...f, creditLimit: e.target.value }))} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={cardForm.currency} onChange={e => setCardForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="CRC">CRC ₡</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Statement Closes (day)</Label>
                  <Input type="number" min="1" max="31" placeholder="25" value={cardForm.statementCloseDay} onChange={e => setCardForm(f => ({ ...f, statementCloseDay: e.target.value }))} />
                </div>
                <div>
                  <Label>Days to Pay After Close</Label>
                  <Input type="number" min="1" max="60" value={cardForm.paymentDueDays} onChange={e => setCardForm(f => ({ ...f, paymentDueDays: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Card Color</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {CARD_COLORS.map(c => (
                    <button
                      key={c} type="button"
                      onClick={() => setCardForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{ background: c, outline: cardForm.color === c ? "2px solid white" : "none", outlineOffset: "2px" }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Saving…" : "Add Card"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddCard(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Charge Modal ─────────────────────────────────────────────────── */}
      {showAddCharge !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Add Charge</h2>
              <button onClick={() => setShowAddCharge(null)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={e => addCharge(e, showAddCharge)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={chargeForm.chargeDate} onChange={e => setChargeForm(f => ({ ...f, chargeDate: e.target.value }))} required />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
              </div>
              <div>
                <Label>Merchant *</Label>
                <Input placeholder="Amazon, Uber, ClickUp…" value={chargeForm.merchant} onChange={e => setChargeForm(f => ({ ...f, merchant: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={chargeForm.category} onChange={e => setChargeForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={chargeForm.currency} onChange={e => setChargeForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="CRC">CRC ₡</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input placeholder="Notes about this charge" value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring" checked={chargeForm.isRecurring} onChange={e => setChargeForm(f => ({ ...f, isRecurring: e.target.checked }))} className="rounded border-zinc-700" />
                <Label htmlFor="recurring" className="cursor-pointer">Recurring charge</Label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Saving…" : "Add Charge"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddCharge(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Statement Modal ──────────────────────────────────────────────── */}
      {showAddStatement !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Log Statement</h2>
              <button onClick={() => setShowAddStatement(null)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={e => addStatement(e, showAddStatement)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Month</Label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={statementForm.statementMonth} onChange={e => setStatementForm(f => ({ ...f, statementMonth: parseInt(e.target.value) }))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Input type="number" value={statementForm.statementYear} onChange={e => setStatementForm(f => ({ ...f, statementYear: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Closing Balance *</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={statementForm.closingBalance} onChange={e => setStatementForm(f => ({ ...f, closingBalance: e.target.value }))} required />
                </div>
                <div>
                  <Label>Minimum Payment</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={statementForm.minimumPayment} onChange={e => setStatementForm(f => ({ ...f, minimumPayment: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Payment Due Date</Label>
                <Input type="date" value={statementForm.paymentDueDate} onChange={e => setStatementForm(f => ({ ...f, paymentDueDate: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount Paid</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={statementForm.paidAmount} onChange={e => setStatementForm(f => ({ ...f, paidAmount: e.target.value }))} />
                </div>
                <div>
                  <Label>Date Paid</Label>
                  <Input type="date" value={statementForm.paidDate} onChange={e => setStatementForm(f => ({ ...f, paidDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={statementForm.status} onChange={e => setStatementForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="open">Open</option>
                  <option value="paid_full">Paid in Full</option>
                  <option value="paid_partial">Partially Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Saving…" : "Save Statement"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddStatement(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
