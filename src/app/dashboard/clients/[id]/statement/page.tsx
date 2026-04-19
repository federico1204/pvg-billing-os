"use client";
import { useEffect, useState, use } from "react";
import { fmt } from "@/lib/utils";
import { Printer, Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Invoice {
  id: number;
  invoice_ref: string;
  project_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: string;
  paid_amount: string;
  currency: string;
  billing_status: string;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const OPEN_STATUSES = ["SENT", "VIEWED", "OVERDUE", "PARTIALLY_PAID", "PROOF_RECEIVED", "WAITING_BANK", "DUE_SOON", "DISPUTED"];

export default function ClientStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(d => {
      setClient(d);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">Loading statement…</div>;
  if (!client) return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">Client not found.</div>;

  const allInvoices: Invoice[] = client.invoices ?? [];
  const openInvoices = allInvoices.filter(i => OPEN_STATUSES.includes(i.billing_status));
  const displayInvoices = showAll ? allInvoices : openInvoices;

  const totalBilled = allInvoices.reduce((s, i) => s + parseFloat(i.total_amount ?? 0), 0);
  const totalPaid = allInvoices.reduce((s, i) => s + parseFloat(i.paid_amount ?? 0), 0);
  const totalOutstanding = Math.max(0, totalBilled - totalPaid);

  const currency = allInvoices[0]?.currency ?? "USD";
  const generatedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const clientName = client.commercial_name || client.name;
  const legalName = client.llc_name && client.llc_name !== clientName ? client.llc_name : null;

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden bg-zinc-950 border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <Link
          href={`/dashboard/clients/${id}`}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          Back to {clientName}
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            {showAll ? "Show outstanding only" : `Show all ${allInvoices.length} invoices`}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Printer size={14} />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Statement — white, clean, printable */}
      <div className="min-h-screen bg-white p-8 print:p-0">
        <div className="max-w-2xl mx-auto print:max-w-none">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 print:mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-sm">P</div>
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-tight">Pura Vida Growth</p>
                  <p className="text-gray-500 text-xs">billing@puravidagrowth.com</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs">Costa Rica · +506 XXXX-XXXX</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">Account Statement</p>
              <p className="text-gray-500 text-sm mt-1">Generated: {generatedDate}</p>
              {!showAll && <p className="text-xs text-orange-600 font-medium mt-1">Outstanding balances only</p>}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-gray-900 mb-6" />

          {/* Client info */}
          <div className="mb-8">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
            <p className="text-xl font-bold text-gray-900">{clientName}</p>
            {legalName && <p className="text-gray-600 text-sm">{legalName}</p>}
            {client.email && <p className="text-gray-500 text-sm">{client.billing_email || client.email}</p>}
          </div>

          {/* Summary boxes */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Billed</p>
              <p className="text-lg font-bold text-gray-900">{fmt(totalBilled, currency)}</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Paid</p>
              <p className="text-lg font-bold text-green-700">{fmt(totalPaid, currency)}</p>
            </div>
            <div className={`border-2 rounded-xl p-4 text-center ${totalOutstanding > 0 ? "border-red-400 bg-red-50" : "border-green-400 bg-green-50"}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Balance Due</p>
              <p className={`text-lg font-bold ${totalOutstanding > 0 ? "text-red-700" : "text-green-700"}`}>
                {fmt(totalOutstanding, currency)}
              </p>
            </div>
          </div>

          {/* Invoice table */}
          <table className="w-full text-sm border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Invoice #</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Date</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Due</th>
                <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Amount</th>
                <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Paid</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Balance</th>
              </tr>
            </thead>
            <tbody>
              {displayInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                    {showAll ? "No invoices found." : "No outstanding balances. ✓ All caught up!"}
                  </td>
                </tr>
              ) : displayInvoices.map((inv, idx) => {
                const total = parseFloat(inv.total_amount ?? 0);
                const paid = parseFloat(inv.paid_amount ?? 0);
                const balance = Math.max(0, total - paid);
                const isOverdue = inv.billing_status === "OVERDUE";
                const isPaid = balance === 0;

                return (
                  <tr
                    key={inv.id}
                    className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="py-3 pr-4">
                      <span className={`font-mono font-bold text-sm ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
                        {inv.invoice_ref}
                      </span>
                      {isOverdue && (
                        <span className="ml-1 text-xs text-red-500 font-medium">OVERDUE</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 max-w-[180px]">
                      <span className="line-clamp-2">{inv.project_name || "Services"}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                    <td className={`py-3 pr-4 text-xs whitespace-nowrap font-medium ${isOverdue ? "text-red-600" : "text-gray-500"}`}>
                      {fmtDate(inv.due_date)}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-gray-900">{fmt(total, inv.currency)}</td>
                    <td className="py-3 pr-4 text-right text-green-700">{paid > 0 ? fmt(paid, inv.currency) : "—"}</td>
                    <td className={`py-3 text-right font-bold ${isPaid ? "text-green-600" : isOverdue ? "text-red-600" : "text-gray-900"}`}>
                      {isPaid ? "✓ Paid" : fmt(balance, inv.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {displayInvoices.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-900">
                  <td colSpan={4} className="py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Total</td>
                  <td className="py-3 pr-4 text-right font-bold text-gray-900">
                    {fmt(displayInvoices.reduce((s, i) => s + parseFloat(i.total_amount ?? 0), 0), currency)}
                  </td>
                  <td className="py-3 pr-4 text-right font-bold text-green-700">
                    {fmt(displayInvoices.reduce((s, i) => s + parseFloat(i.paid_amount ?? 0), 0), currency)}
                  </td>
                  <td className="py-3 text-right font-bold text-gray-900">
                    {fmt(displayInvoices.reduce((s, i) => s + Math.max(0, parseFloat(i.total_amount ?? 0) - parseFloat(i.paid_amount ?? 0)), 0), currency)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Payment instructions */}
          {totalOutstanding > 0 && (
            <div className="border border-gray-200 rounded-xl p-5 mb-8 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment Instructions</p>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="font-semibold text-gray-700 mb-1">USD — Wire Transfer</p>
                  <p className="text-gray-600 text-xs leading-relaxed">
                    Bank: BAC San José<br />
                    Beneficiary: Pura Vida Growth Innovation S.A.<br />
                    IBAN: CR92 0102 0000 9548 7763 51<br />
                    SWIFT: BACCCRSX
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-1">CRC — SINPE Móvil</p>
                  <p className="text-gray-600 text-xs leading-relaxed">
                    Number: {client.sinpeNumber || "8888-8888"}<br />
                    Name: Federico Rojas / Pura Vida Growth
                  </p>
                </div>
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-xs text-amber-800">
                  <strong>⚠️ Important:</strong> Please include your invoice number(s) <strong className="font-mono">
                    {displayInvoices.filter(i => Math.max(0, parseFloat(i.total_amount ?? 0) - parseFloat(i.paid_amount ?? 0)) > 0).map(i => i.invoice_ref).join(", ")}
                  </strong> in the transfer description so we can apply your payment immediately.
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <p className="text-xs text-gray-400">
              Pura Vida Growth Innovation S.A. · billing@puravidagrowth.com · Costa Rica<br />
              Questions about this statement? Reply to this email or contact us directly.
            </p>
          </div>

        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </>
  );
}
