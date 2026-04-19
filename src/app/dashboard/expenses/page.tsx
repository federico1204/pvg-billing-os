"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/utils";
import { Plus, Trash2, Search, TrendingDown, TrendingUp, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Advertising & Marketing",
  "Bank Fees",
  "Client Payment",
  "Contractors & Freelancers",
  "Equipment & Hardware",
  "Insurance",
  "Loans & Investment Received",
  "Loan Repayment",
  "Meals & Entertainment",
  "Office Supplies",
  "Payroll & Salaries",
  "Professional Services",
  "Rent & Utilities",
  "Software & Subscriptions",
  "Taxes & Licenses",
  "Training & Education",
  "Travel & Transportation",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Advertising & Marketing": "bg-rose-900/60 text-rose-300",
  "Bank Fees": "bg-zinc-800 text-zinc-400",
  "Client Payment": "bg-green-900/60 text-green-300",
  "Contractors & Freelancers": "bg-violet-900/60 text-violet-300",
  "Equipment & Hardware": "bg-amber-900/60 text-amber-300",
  "Insurance": "bg-cyan-900/60 text-cyan-300",
  "Loans & Investment Received": "bg-emerald-900/60 text-emerald-300",
  "Loan Repayment": "bg-red-900/60 text-red-300",
  "Meals & Entertainment": "bg-orange-900/60 text-orange-300",
  "Office Supplies": "bg-sky-900/60 text-sky-300",
  "Payroll & Salaries": "bg-blue-900/60 text-blue-300",
  "Professional Services": "bg-teal-900/60 text-teal-300",
  "Rent & Utilities": "bg-yellow-900/60 text-yellow-300",
  "Software & Subscriptions": "bg-indigo-900/60 text-indigo-300",
  "Taxes & Licenses": "bg-orange-950 text-orange-400",
  "Training & Education": "bg-lime-900/60 text-lime-300",
  "Travel & Transportation": "bg-pink-900/60 text-pink-300",
  "Other": "bg-zinc-800 text-zinc-500",
};

interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  vendor: string | null;
  notes: string | null;
}

function isIncome(e: Expense) {
  const notes = e.notes ?? "";
  // Primary signal: the bank import stamps every entry with "Ingreso ·" (credit) or "Gasto ·" (debit)
  if (notes.startsWith("Ingreso")) return true;
  if (notes.startsWith("Gasto") || notes.startsWith("Pagos:")) return false;
  // Fallback for manually-logged entries: rely on category
  return e.category === "Client Payment";
  // Note: "Loans & Investment Received" alone is NOT enough — a loan repayment can have the same
  // category if miscategorized. The "Ingreso" prefix is the authoritative signal.
}

function cleanNotes(notes: string | null): string | null {
  if (!notes) return null;
  // Strip "Gasto · filename" or "Ingreso · filename" prefixes, keep only the trailing meaningful part
  const stripped = notes
    .replace(/^(Gasto|Ingreso)\s*·\s*[^·]+\s*·?\s*/i, "")
    .replace(/^Pagos:\s*\/[^/]+\/[^/]+\/[^/]+\/[^/]+\//, "Pagos: …/")
    .replace(/^Pagos:\s*\/[^/]+\/[^/]+\//, "Pagos: …/")
    .trim();
  return stripped || null;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtYear(dateStr: string) {
  return new Date(dateStr + "T12:00:00").getFullYear().toString();
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const currentYear = new Date().getFullYear().toString();
  const [periodFilter, setPeriodFilter] = useState(currentYear); // "all" | "YYYY" | "YYYY-MM"
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], description: "", amount: "", currency: "USD", category: "", vendor: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/expenses");
    setExpenses(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Build available period options from data
  const availableYears = Array.from(new Set(expenses.map(e => e.date.slice(0, 4)))).sort().reverse();
  const availableMonths = Array.from(new Set(expenses.map(e => e.date.slice(0, 7)))).sort().reverse();

  const filtered = expenses.filter((e) => {
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !(e.vendor ?? "").toLowerCase().includes(search.toLowerCase()) && !(e.notes ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;
    if (typeFilter === "income" && !isIncome(e)) return false;
    if (typeFilter === "expense" && isIncome(e)) return false;
    // periodFilter can be "all", "YYYY", or "YYYY-MM"
    if (periodFilter !== "all" && !e.date.startsWith(periodFilter)) return false;
    return true;
  });

  const usdExpenses = filtered.filter(e => e.currency === "USD" && !isIncome(e));
  const usdIncome = filtered.filter(e => e.currency === "USD" && isIncome(e));
  const crcExpenses = filtered.filter(e => e.currency === "CRC" && !isIncome(e));
  const crcIncome = filtered.filter(e => e.currency === "CRC" && isIncome(e));

  const totalUSDOut = usdExpenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const totalUSDIn = usdIncome.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const totalCRCOut = crcExpenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const totalCRCIn = crcIncome.reduce((s, e) => s + parseFloat(String(e.amount)), 0);

  // Category breakdown (USD only, expenses only)
  const byCategory: Record<string, number> = {};
  for (const e of expenses.filter(e => e.currency === "USD" && !isIncome(e))) {
    const cat = e.category || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + parseFloat(String(e.amount));
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  async function createExpense(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) {
      setShowNew(false);
      setForm({ date: new Date().toISOString().split("T")[0], description: "", amount: "", currency: "USD", category: "", vendor: "", notes: "" });
      await load();
    }
    setSubmitting(false);
  }

  async function deleteExpense(id: number) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {filtered.length} entries
            {periodFilter !== "all" && (
              <span className="ml-1 text-zinc-500">
                · {periodFilter.length === 4
                  ? `${periodFilter} YTD`
                  : new Date(periodFilter + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" })
                }
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={16} />Log Expense</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown size={13} className="text-red-400" />
            <p className="text-xs text-zinc-400">USD Expenses</p>
          </div>
          <p className="text-xl font-bold text-white">{fmt(totalUSDOut)}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{usdExpenses.length} entries</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={13} className="text-green-400" />
            <p className="text-xs text-zinc-400">USD Income</p>
          </div>
          <p className="text-xl font-bold text-green-400">{fmt(totalUSDIn)}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{usdIncome.length} entries</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown size={13} className="text-red-400" />
            <p className="text-xs text-zinc-400">CRC Expenses</p>
          </div>
          <p className="text-xl font-bold text-white">{fmt(totalCRCOut, "CRC")}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{crcExpenses.length} entries</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={13} className="text-green-400" />
            <p className="text-xs text-zinc-400">CRC Income</p>
          </div>
          <p className="text-xl font-bold text-green-400">{fmt(totalCRCIn, "CRC")}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{crcIncome.length} entries</p>
        </div>
      </div>

      {/* Top USD expense categories */}
      {topCategories.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <p className="text-xs text-zinc-400 mb-3 font-medium">TOP EXPENSE CATEGORIES (USD)</p>
          <div className="flex gap-6 flex-wrap">
            {topCategories.map(([cat, amt]) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
                className="flex items-center gap-2 group"
              >
                <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-zinc-800 text-zinc-400"} ${categoryFilter === cat ? "ring-1 ring-white/30" : ""}`}>{cat}</span>
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{fmt(amt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input className="pl-8" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Period filter */}
        <select
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          <option value="all">All Time</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y} — Full Year</option>
          ))}
          <optgroup label="By Month">
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {new Date(m + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </option>
            ))}
          </optgroup>
        </select>

        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          {(["all", "expense", "income"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${typeFilter === t ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
            >
              {t === "all" ? "All" : t === "expense" ? "Expenses" : "Income"}
            </button>
          ))}
        </div>

        {/* Currency toggle */}
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          {(["all", "USD", "CRC"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrencyFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${currencyFilter === c ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
            >
              {c === "all" ? "All Currencies" : c}
            </button>
          ))}
        </div>

        <select
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {(search || categoryFilter !== "all" || currencyFilter !== "all" || typeFilter !== "all" || periodFilter !== currentYear) && (
          <button
            onClick={() => { setSearch(""); setCategoryFilter("all"); setCurrencyFilter("all"); setTypeFilter("all"); setPeriodFilter(currentYear); }}
            className="text-xs text-zinc-500 hover:text-white px-2 transition-colors"
          >
            Reset filters
          </button>
        )}

        <span className="ml-auto text-xs text-zinc-500 self-center">{filtered.length} entries</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">Loading...</div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs w-20">Date</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Description</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Category</th>
                <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-xs">Vendor / Payee</th>
                <th className="text-right px-4 py-2.5 text-zinc-500 font-medium text-xs">Amount</th>
                <th className="w-8 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-zinc-500">No entries found</td></tr>
              ) : filtered.map((e) => {
                const income = isIncome(e);
                const note = cleanNotes(e.notes);
                const catColor = CATEGORY_COLORS[e.category ?? ""] ?? "bg-zinc-800 text-zinc-500";
                return (
                  <tr key={e.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-zinc-400 font-medium">{fmtDate(e.date)}</div>
                      <div className="text-xs text-zinc-600">{fmtYear(e.date)}</div>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        {income
                          ? <ArrowDownLeft size={12} className="text-green-500 shrink-0" />
                          : <ArrowUpRight size={12} className="text-zinc-600 shrink-0" />
                        }
                        <span className="text-white text-sm truncate">{e.description}</span>
                      </div>
                      {note && <p className="text-xs text-zinc-500 mt-0.5 pl-[18px] truncate">{note}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${catColor}`}>
                          {e.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs max-w-[160px]">
                      <span className="truncate block">{e.vendor || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-medium tabular-nums ${income ? "text-green-400" : "text-white"}`}>
                        {income ? "+" : ""}{fmt(parseFloat(String(e.amount)), e.currency)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => deleteExpense(e.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New expense modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Log Expense</h2>
              <button onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={createExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div>
                  <Label>Currency</Label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="CRC">CRC (₡)</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <Label>Category</Label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select category...</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label>Description *</Label>
                  <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} required />
                </div>
                <div className="col-span-2">
                  <Label>Vendor / Payee</Label>
                  <Input value={form.vendor} onChange={(e) => setForm(f => ({ ...f, vendor: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <textarea className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[60px] resize-y" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Saving..." : "Log Expense"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
