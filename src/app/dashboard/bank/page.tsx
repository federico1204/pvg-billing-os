"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/utils";

interface BankEntry {
  id: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  vendor: string | null;
  notes: string | null;
}

interface Invoice {
  id: number;
  invoice_ref: string;
  due_date: string | null;
  billing_status: string | null;
  total_amount: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function matchInvoice(entry: BankEntry, invoices: Invoice[]): string | null {
  const entryDate = new Date(entry.date + "T12:00:00");
  for (const inv of invoices) {
    if (!inv.due_date) continue;
    // Only try to match paid invoices
    if (inv.billing_status !== "PAID" && inv.billing_status !== "PARTIALLY_PAID") continue;
    const dueDate = new Date(inv.due_date + "T12:00:00");
    // Match if bank credit falls within 7 days of due date
    const diffDays = Math.abs((entryDate.getTime() - dueDate.getTime()) / 86400000);
    if (diffDays <= 7) return inv.invoice_ref;
  }
  return null;
}

export default function BankPage() {
  const [income, setIncome] = useState<BankEntry[]>([]);
  const [expenses, setExpenses] = useState<BankEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"income" | "expenses">("income");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [bankRes, invRes] = await Promise.all([
        fetch("/api/bank"),
        fetch("/api/invoices"),
      ]);
      const bankData = await bankRes.json();
      const invData = await invRes.json();
      setIncome(bankData.income ?? []);
      setExpenses(bankData.expenses ?? []);
      setInvoices(invData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Collect available months from all entries
  const allEntries = [...income, ...expenses];
  const months = Array.from(new Set(allEntries.map(e => getMonthKey(e.date)))).sort().reverse();

  function filterByMonth<T extends BankEntry>(entries: T[]) {
    if (monthFilter === "all") return entries;
    return entries.filter(e => getMonthKey(e.date) === monthFilter);
  }

  const filteredIncome = filterByMonth(income);
  const filteredExpenses = filterByMonth(expenses);

  const totalIncomeUSD = filteredIncome.filter(e => e.currency === "USD").reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const totalExpensesUSD = filteredExpenses.filter(e => e.currency === "USD").reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const netUSD = totalIncomeUSD - totalExpensesUSD;

  const totalIncomeCRC = filteredIncome.filter(e => e.currency === "CRC").reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const totalExpensesCRC = filteredExpenses.filter(e => e.currency === "CRC").reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const netCRC = totalIncomeCRC - totalExpensesCRC;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Bank Transactions</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {income.length} income entries · {expenses.length} expense entries
          </p>
        </div>
        <select
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="all">All Months</option>
          {months.map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 mb-1">Total Income</p>
          <p className="text-2xl font-bold text-green-400">{fmt(totalIncomeUSD, "USD")}</p>
          {totalIncomeCRC > 0 && <p className="text-xs text-green-600 mt-1">{fmt(totalIncomeCRC, "CRC")}</p>}
          <p className="text-xs text-zinc-500 mt-1">{filteredIncome.length} entries</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-400">{fmt(totalExpensesUSD, "USD")}</p>
          {totalExpensesCRC > 0 && <p className="text-xs text-red-600 mt-1">{fmt(totalExpensesCRC, "CRC")}</p>}
          <p className="text-xs text-zinc-500 mt-1">{filteredExpenses.length} entries</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 mb-1">Net</p>
          <p className={`text-2xl font-bold ${netUSD >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(netUSD, "USD")}</p>
          {(totalIncomeCRC > 0 || totalExpensesCRC > 0) && (
            <p className={`text-xs mt-1 ${netCRC >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(netCRC, "CRC")}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-4">
        <button
          onClick={() => setTab("income")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "income"
              ? "border-green-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Income / Credits
        </button>
        <button
          onClick={() => setTab("expenses")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "expenses"
              ? "border-red-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Expenses / Debits
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">Loading...</div>
      ) : tab === "income" ? (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Description</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Currency</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Matched Invoice</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncome.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">
                    No income entries found. Import bank statements to see credits here.
                  </td>
                </tr>
              ) : filteredIncome.map((e) => {
                const matched = matchInvoice(e, invoices);
                return (
                  <tr key={e.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 text-white">{e.description}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-400">{fmt(parseFloat(String(e.amount)), e.currency)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{e.currency}</td>
                    <td className="px-4 py-3">
                      {e.category ? (
                        <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{e.category}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {matched ? (
                        <span className="text-blue-400 font-mono">{matched}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] truncate">{e.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Description</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Currency</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Vendor</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">
                    No expense entries found. Import bank statements to see debits here.
                  </td>
                </tr>
              ) : filteredExpenses.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 text-white">{e.description}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-400">{fmt(parseFloat(String(e.amount)), e.currency)}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{e.currency}</td>
                  <td className="px-4 py-3">
                    {e.category ? (
                      <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{e.category}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{e.vendor || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] truncate">{e.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
