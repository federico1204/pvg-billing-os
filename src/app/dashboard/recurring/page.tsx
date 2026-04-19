"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/utils";
import { Plus, Play, Pause, Zap, Pencil, Trash2, RefreshCw, CalendarClock, Sparkles, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

interface Client {
  id: number;
  commercial_name: string;
  llc_name: string | null;
  email: string | null;
  billing_email: string | null;
}

interface RecurringInvoice {
  id: number;
  client_id: number;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  frequency: string;
  day_of_month: number;
  service_category: string | null;
  next_run_date: string;
  last_run_date: string | null;
  auto_send: boolean;
  is_active: boolean;
  clients: Client | null;
}

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly",
  bi_monthly: "Every 2 Months",
  quarterly: "Quarterly",
  annual: "Annual",
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number): string {
  if (days < 0) return "text-red-400";
  if (days === 0) return "text-orange-400";
  if (days <= 3) return "text-yellow-400";
  return "text-zinc-400";
}

const emptyForm = {
  clientId: "",
  name: "",
  description: "",
  amount: "",
  currency: "USD",
  frequency: "monthly",
  dayOfMonth: "1",
  serviceCategory: "",
  nextRunDate: new Date().toISOString().split("T")[0],
  autoSend: false,
};

export default function RecurringPage() {
  const router = useRouter();
  const [items, setItems] = useState<RecurringInvoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [rRes, cRes] = await Promise.all([
      fetch("/api/recurring"),
      fetch("/api/clients"),
    ]);
    const [rData, cData] = await Promise.all([rRes.json(), cRes.json()]);
    setItems(rData);
    setClients(cData.filter((c: any) => !c.isSubEntity));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(item: RecurringInvoice) {
    setEditing(item);
    setForm({
      clientId: String(item.client_id),
      name: item.name,
      description: item.description ?? "",
      amount: item.amount,
      currency: item.currency,
      frequency: item.frequency,
      dayOfMonth: String(item.day_of_month),
      serviceCategory: item.service_category ?? "",
      nextRunDate: item.next_run_date,
      autoSend: item.auto_send,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      clientId: parseInt(form.clientId),
      name: form.name,
      description: form.description || null,
      amount: parseFloat(form.amount),
      currency: form.currency,
      frequency: form.frequency,
      dayOfMonth: parseInt(form.dayOfMonth),
      serviceCategory: form.serviceCategory || null,
      nextRunDate: form.nextRunDate,
      autoSend: form.autoSend,
    };

    if (editing) {
      await fetch(`/api/recurring/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowForm(false);
    setSubmitting(false);
    load();
  }

  async function toggleActive(item: RecurringInvoice) {
    await fetch(`/api/recurring/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.is_active }),
    });
    load();
  }

  async function handleDelete(item: RecurringInvoice) {
    if (!confirm(`Delete recurring template "${item.name}"?`)) return;
    await fetch(`/api/recurring/${item.id}`, { method: "DELETE" });
    load();
  }

  async function handleGenerate(item: RecurringInvoice) {
    setGenerating(item.id);
    const res = await fetch(`/api/recurring/${item.id}/generate`, { method: "POST" });
    if (res.ok) {
      const { invoice } = await res.json();
      await load();
      router.push(`/dashboard/invoices/${invoice.id}`);
    } else {
      const err = await res.json();
      alert("Error: " + err.error);
      setGenerating(null);
    }
  }

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recurring/suggestions")
      .then(r => r.json())
      .then(d => { setSuggestions(d); setLoadingSuggestions(false); });
  }, []);

  // Next month day 1 as default next run date
  function nextMonthFirst() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toISOString().split("T")[0];
  }

  async function createTemplateFromSuggestion(s: any) {
    await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: s.clientId,
        name: s.lastProject || "Monthly Retainer",
        amount: s.suggestedAmount,
        currency: s.currency,
        frequency: "monthly",
        dayOfMonth: 1,
        nextRunDate: nextMonthFirst(),
        autoSend: false,
      }),
    });
  }

  async function bulkCreateAll() {
    const pending = suggestions.filter(s => !s.hasTemplate && s.confidence !== "low");
    if (!pending.length) return;
    if (!confirm(`Create recurring templates for ${pending.length} client${pending.length > 1 ? "s" : ""}? You can edit details after.`)) return;
    setBulkCreating(true);
    setBulkResult(null);
    await Promise.all(pending.map(createTemplateFromSuggestion));
    setBulkResult(`Created ${pending.length} recurring template${pending.length > 1 ? "s" : ""}.`);
    setBulkCreating(false);
    await load();
    // Refresh suggestions
    fetch("/api/recurring/suggestions").then(r => r.json()).then(d => setSuggestions(d));
  }

  const active = items.filter(i => i.is_active);
  const paused = items.filter(i => !i.is_active);
  const dueThisWeek = active.filter(i => daysUntil(i.next_run_date) <= 7);

  const totalMonthlyUSD = active
    .filter(i => i.currency === "USD" && i.frequency === "monthly")
    .reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Recurring Invoices</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {active.length} active · {fmt(totalMonthlyUSD)}/mo recurring revenue
          </p>
        </div>
        <Button onClick={openNew}><Plus size={16} />New Template</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock size={14} className="text-zinc-400" />
            <p className="text-xs text-zinc-400">Active Templates</p>
          </div>
          <p className="text-2xl font-bold text-white">{active.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw size={14} className="text-zinc-400" />
            <p className="text-xs text-zinc-400">Monthly Recurring (USD)</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{fmt(totalMonthlyUSD)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className={dueThisWeek.length > 0 ? "text-yellow-400" : "text-zinc-400"} />
            <p className="text-xs text-zinc-400">Due This Week</p>
          </div>
          <p className={`text-2xl font-bold ${dueThisWeek.length > 0 ? "text-yellow-400" : "text-white"}`}>
            {dueThisWeek.length}
          </p>
        </div>
      </div>

      {/* AI Suggestions */}
      {!loadingSuggestions && suggestions.filter(s => !s.hasTemplate).length > 0 && (
        <div className="mb-6 bg-indigo-950/30 border border-indigo-800/50 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <button
              onClick={() => setShowSuggestions(v => !v)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Sparkles size={15} className="text-indigo-400" />
              <span className="text-sm font-semibold text-white">
                {suggestions.filter(s => !s.hasTemplate).length} Clients Recommended for Recurring
              </span>
              <span className="text-xs bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full">
                Based on invoice history
              </span>
              {showSuggestions ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
            </button>
            {suggestions.filter(s => !s.hasTemplate && s.confidence !== "low").length > 1 && (
              <Button
                size="sm"
                onClick={bulkCreateAll}
                disabled={bulkCreating}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 border-0 shrink-0"
              >
                {bulkCreating ? <><RefreshCw size={12} className="animate-spin" />Creating…</> : <><Zap size={12} />Set Up All ({suggestions.filter(s => !s.hasTemplate && s.confidence !== "low").length})</>}
              </Button>
            )}
          </div>

          {bulkResult && (
            <div className="mx-5 mb-3 px-3 py-2 bg-green-900/30 border border-green-800 rounded-lg text-xs text-green-300 flex items-center gap-1.5">
              <CheckCircle size={12} />{bulkResult}
            </div>
          )}

          {showSuggestions && (
            <div className="border-t border-indigo-800/30 divide-y divide-indigo-800/20">
              {suggestions.filter(s => !s.hasTemplate).map(s => {
                const confColor = s.confidence === "high" ? "text-green-400 bg-green-900/30 border-green-800/50"
                  : s.confidence === "medium" ? "text-yellow-400 bg-yellow-900/20 border-yellow-800/40"
                  : "text-zinc-400 bg-zinc-800/30 border-zinc-700/40";
                return (
                  <div key={s.clientId} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-medium text-white">{s.clientName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${confColor} capitalize`}>
                          {s.confidence} confidence
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">{s.reason}</p>
                      {s.lastProject && (
                        <p className="text-xs text-zinc-600 mt-0.5">Last project: {s.lastProject}</p>
                      )}
                    </div>
                    <div className="text-right min-w-[120px]">
                      <p className="text-sm font-semibold text-white">{fmt(s.suggestedAmount, s.currency)}</p>
                      <p className="text-xs text-zinc-500">suggested / mo</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await createTemplateFromSuggestion(s);
                          await load();
                          fetch("/api/recurring/suggestions").then(r => r.json()).then(d => setSuggestions(d));
                        }}
                        className="text-xs"
                      >
                        <Plus size={12} /> Quick Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(null);
                          setForm({
                            ...emptyForm,
                            clientId: String(s.clientId),
                            name: s.lastProject ?? "Monthly Retainer",
                            amount: String(s.suggestedAmount),
                            currency: s.currency,
                          });
                          setShowForm(true);
                        }}
                        className="text-xs text-zinc-400"
                      >
                        Edit & Add
                      </Button>
                    </div>
                  </div>
                );
              })}
              {suggestions.filter(s => s.hasTemplate).length > 0 && (
                <div className="px-5 py-3 bg-zinc-900/30">
                  <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                    <CheckCircle size={11} className="text-green-700" />
                    {suggestions.filter(s => s.hasTemplate).length} client{suggestions.filter(s => s.hasTemplate).length > 1 ? "s" : ""} already have active recurring templates
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-zinc-700 rounded-xl py-16 text-center">
          <CalendarClock size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium mb-1">No recurring templates yet</p>
          <p className="text-zinc-600 text-sm mb-4">Set up monthly retainer invoices so you never forget to bill a client.</p>
          <Button onClick={openNew}><Plus size={16} />Create First Template</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active templates */}
          {active.map(item => {
            const days = daysUntil(item.next_run_date);
            const isGenerating = generating === item.id;
            return (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
              >
                {/* Status dot */}
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-0.5" />

                {/* Client + name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium text-sm">{item.name}</p>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      {FREQ_LABELS[item.frequency] ?? item.frequency}
                    </span>
                    {item.auto_send && (
                      <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">Auto-send</span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {item.clients?.commercial_name ?? "—"} · {item.clients?.billing_email || item.clients?.email || "no email"}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right min-w-[100px]">
                  <p className="text-white font-semibold">{fmt(parseFloat(item.amount), item.currency)}</p>
                  <p className="text-zinc-500 text-xs">{item.currency}</p>
                </div>

                {/* Next run */}
                <div className="text-right min-w-[120px]">
                  <p className={`text-sm font-medium ${urgencyColor(days)}`}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `In ${days}d`}
                  </p>
                  <p className="text-zinc-500 text-xs">{item.next_run_date}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerate(item)}
                    disabled={isGenerating}
                    className="text-green-400 border-green-800 hover:bg-green-900/30 hover:text-green-300"
                  >
                    {isGenerating ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                    {isGenerating ? "Creating…" : "Generate"}
                  </Button>
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => toggleActive(item)}
                    className="p-1.5 text-zinc-500 hover:text-yellow-400 transition-colors"
                    title="Pause"
                  >
                    <Pause size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Paused templates */}
          {paused.length > 0 && (
            <>
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider pt-4 pb-1">Paused</p>
              {paused.map(item => (
                <div
                  key={item.id}
                  className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-4 flex items-center gap-4 opacity-60"
                >
                  <div className="w-2 h-2 rounded-full bg-zinc-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-400 font-medium text-sm">{item.name}</p>
                    <p className="text-zinc-600 text-xs mt-0.5">{item.clients?.commercial_name ?? "—"}</p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-zinc-500 font-semibold">{fmt(parseFloat(item.amount), item.currency)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 text-zinc-600 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => toggleActive(item)}
                      className="p-1.5 text-zinc-600 hover:text-green-400 transition-colors"
                      title="Resume"
                    >
                      <Play size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">
                {editing ? "Edit Recurring Template" : "New Recurring Template"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <Label>Client *</Label>
                <select
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  required
                >
                  <option value="">Select client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.commercial_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Template Name * <span className="text-zinc-500 font-normal">(appears on invoice)</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Monthly Retainer — Social Media"
                  required
                />
              </div>

              <div>
                <Label>Description <span className="text-zinc-500 font-normal">(optional notes for invoice)</span></Label>
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[60px] resize-y"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Services included: social media, content calendar, reels…"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="1500.00"
                    required
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="USD">USD</option>
                    <option value="CRC">CRC</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequency</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="bi_monthly">Every 2 Months</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <Label>Invoice Day of Month</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={form.dayOfMonth}
                    onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Next Run Date *</Label>
                <Input
                  type="date"
                  value={form.nextRunDate}
                  onChange={e => setForm(f => ({ ...f, nextRunDate: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label>Service Category <span className="text-zinc-500 font-normal">(optional)</span></Label>
                <Input
                  value={form.serviceCategory}
                  onChange={e => setForm(f => ({ ...f, serviceCategory: e.target.value }))}
                  placeholder="e.g. Social Media, Branding, SEO…"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSend"
                  checked={form.autoSend}
                  onChange={e => setForm(f => ({ ...f, autoSend: e.target.checked }))}
                  className="rounded border-zinc-700"
                />
                <Label htmlFor="autoSend" className="cursor-pointer">
                  Auto-send email when generated <span className="text-zinc-500 font-normal">(uses client preferred language)</span>
                </Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving…" : editing ? "Save Changes" : "Create Template"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
