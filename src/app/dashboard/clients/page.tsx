"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/utils";
import { Plus, Search, Users, TrendingUp, AlertCircle } from "lucide-react";

interface Client {
  id: number;
  client_ref: string | null;
  name: string;
  commercial_name: string | null;
  llc_name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  country: string | null;
  sinpeNumber: string | null;
  notes: string | null;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  invoiceCount: number;
  isSubEntity: boolean;
  siblingCount: number;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ commercialName: "", llcName: "", email: "", company: "", phone: "", country: "Costa Rica", sinpeNumber: "", notes: "", preferredLanguage: "en" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/clients");
    setClients(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = clients.filter((c) => {
    // Hide sub-entity clients (they show aggregated under the canonical client) unless searching
    if (c.isSubEntity && search === "") return false;
    return search === "" ||
      (c.commercial_name ?? c.name).toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase());
  });

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: form.commercialName }),
    });
    if (res.ok) {
      const created = await res.json();
      setShowNew(false);
      setForm({ commercialName: "", llcName: "", email: "", company: "", phone: "", country: "Costa Rica", sinpeNumber: "", notes: "", preferredLanguage: "en" });
      router.push(`/dashboard/clients/${created.id}`);
    }
    setSubmitting(false);
  }

  const totalOutstanding = clients.reduce((s, c) => s + c.outstanding, 0);
  const totalBilled = clients.reduce((s, c) => s + c.totalBilled, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{clients.length} clients · {fmt(totalBilled)} total billed · {fmt(totalOutstanding)} outstanding</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={16} />New Client</Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-zinc-400" /><p className="text-xs text-zinc-400">Total Clients</p></div>
          <p className="text-2xl font-bold text-white">{clients.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-zinc-400" /><p className="text-xs text-zinc-400">Total Billed</p></div>
          <p className="text-2xl font-bold text-green-400">{fmt(totalBilled)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle size={14} className="text-zinc-400" /><p className="text-xs text-zinc-400">Outstanding</p></div>
          <p className="text-2xl font-bold text-red-400">{fmt(totalOutstanding)}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input className="pl-8" placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">Loading...</div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium w-8">ID</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Client</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Contact</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Invoices</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Total Billed</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-zinc-500">No clients found</td></tr>
              ) : filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                  className="border-b border-zinc-800 hover:bg-zinc-900 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-500">{c.client_ref ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{c.commercial_name || c.name}</p>
                      {c.siblingCount > 1 && (
                        <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{c.siblingCount} LLCs</span>
                      )}
                    </div>
                    {c.llc_name && c.llc_name !== (c.commercial_name || c.name) && <p className="text-xs text-zinc-500">{c.llc_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p>{c.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">{c.invoiceCount}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{fmt(c.totalBilled)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={c.outstanding > 0 ? "text-red-400" : "text-green-400"}>{fmt(c.outstanding)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">New Client</h2>
              <button onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={createClient} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Commercial Name * <span className="text-zinc-500 font-normal">(brand / trade name)</span></Label>
                  <Input value={form.commercialName} onChange={(e) => setForm(f => ({ ...f, commercialName: e.target.value }))} placeholder="e.g. Nacho's Restaurant" required />
                </div>
                <div>
                  <Label>S.A. / SRL / Legal Name <span className="text-zinc-500 font-normal">(razón social)</span></Label>
                  <Input value={form.llcName} onChange={(e) => setForm(f => ({ ...f, llcName: e.target.value }))} placeholder="e.g. Restaurante Nacho S.A." />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} />
                </div>
                <div>
                  <Label>SINPE Móvil</Label>
                  <Input placeholder="8888-8888" value={form.sinpeNumber} onChange={(e) => setForm(f => ({ ...f, sinpeNumber: e.target.value }))} />
                </div>
                <div>
                  <Label>Preferred Language</Label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={form.preferredLanguage} onChange={(e) => setForm(f => ({ ...f, preferredLanguage: e.target.value }))}>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <textarea className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[80px] resize-y" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Creating..." : "Create Client"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
