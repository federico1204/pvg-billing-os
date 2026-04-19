"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Advertising & Marketing",
  "Contractors & Freelancers",
  "Software & Subscriptions",
  "Office Supplies",
  "Professional Services",
  "Travel & Transportation",
  "Meals & Entertainment",
  "Equipment & Hardware",
  "Rent & Utilities",
  "Insurance",
  "Taxes & Licenses",
  "Payroll & Salaries",
  "Bank Fees",
  "Other",
];

interface Vendor {
  id: number;
  name: string;
  email: string | null;
  domain: string | null;
  default_category: string | null;
  default_currency: string;
  is_recurring: boolean;
  typical_amount: number | null;
  notes: string | null;
  created_at: string;
}

const emptyForm = {
  name: "",
  email: "",
  domain: "",
  defaultCategory: "",
  defaultCurrency: "USD",
  isRecurring: false,
  typicalAmount: "",
  notes: "",
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/vendors");
    setVendors(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(v: Vendor) {
    setEditingId(v.id);
    setForm({
      name: v.name,
      email: v.email ?? "",
      domain: v.domain ?? "",
      defaultCategory: v.default_category ?? "",
      defaultCurrency: v.default_currency,
      isRecurring: v.is_recurring,
      typicalAmount: v.typical_amount != null ? String(v.typical_amount) : "",
      notes: v.notes ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name,
      email: form.email || null,
      domain: form.domain || null,
      defaultCategory: form.defaultCategory || null,
      defaultCurrency: form.defaultCurrency,
      isRecurring: form.isRecurring,
      typicalAmount: form.typicalAmount ? parseFloat(form.typicalAmount) : null,
      notes: form.notes || null,
    };

    if (editingId !== null) {
      await fetch(`/api/vendors/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    closeModal();
    await load();
    setSubmitting(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete vendor "${name}"?`)) return;
    await fetch(`/api/vendors/${id}`, { method: "DELETE" });
    setVendors(prev => prev.filter(v => v.id !== id));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendors</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{vendors.length} vendors</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} />Add Vendor</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">Loading...</div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Domain / Email</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Currency</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Recurring</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Typical Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">No vendors yet. Add your first vendor.</td>
                </tr>
              ) : vendors.map((v) => (
                <tr key={v.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{v.name}</p>
                    {v.notes && <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[180px]">{v.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {v.domain && <p className="text-zinc-300">{v.domain}</p>}
                    {v.email && <p className="text-zinc-500">{v.email}</p>}
                    {!v.domain && !v.email && "—"}
                  </td>
                  <td className="px-4 py-3">
                    {v.default_category ? (
                      <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{v.default_category}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{v.default_currency}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.is_recurring ? "bg-green-900/60 text-green-300" : "bg-zinc-800 text-zinc-500"}`}>
                      {v.is_recurring ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 text-sm">
                    {v.typical_amount != null ? fmt(v.typical_amount, v.default_currency) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(v)}
                        className="text-zinc-500 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(v.id, v.name)}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">
                {editingId !== null ? "Edit Vendor" : "Add Vendor"}
              </h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Resend, AWS, Notion"
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="billing@vendor.com"
                  />
                </div>
                <div>
                  <Label>Domain</Label>
                  <Input
                    value={form.domain}
                    onChange={(e) => setForm(f => ({ ...f, domain: e.target.value }))}
                    placeholder="resend.com"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Category *</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={form.defaultCategory}
                    onChange={(e) => setForm(f => ({ ...f, defaultCategory: e.target.value }))}
                    required
                  >
                    <option value="">Select category...</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={form.defaultCurrency}
                    onChange={(e) => setForm(f => ({ ...f, defaultCurrency: e.target.value }))}
                  >
                    <option value="USD">USD</option>
                    <option value="CRC">CRC (₡)</option>
                  </select>
                </div>
                <div>
                  <Label>Typical Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.typicalAmount}
                    onChange={(e) => setForm(f => ({ ...f, typicalAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.isRecurring ? "bg-green-600" : "bg-zinc-700"}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.isRecurring ? "translate-x-4" : "translate-x-1"}`}
                    />
                  </button>
                  <Label className="cursor-pointer" onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}>
                    Recurring vendor
                  </Label>
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <textarea
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[60px] resize-y"
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving..." : editingId !== null ? "Save Changes" : "Add Vendor"}
                </Button>
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
