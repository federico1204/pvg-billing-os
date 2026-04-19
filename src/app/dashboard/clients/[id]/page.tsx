"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { fmt, computeBillingStatus, daysOverdue } from "@/lib/utils";
import {
  ArrowLeft, Edit2, Save, X, FileText, DollarSign, Plus, Trash2, Users,
  Bell, TrendingUp, Heart, AlertTriangle, Sparkles, Mail, Copy, Check, ClipboardList,
  ChevronDown, ChevronRight, CreditCard, Send, ExternalLink, Receipt,
} from "lucide-react";
import Link from "next/link";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  invoice_recipient: "Invoice Recipient",
  payer: "Payer",
  both: "Both",
  llc_primary: "LLC Primary",
  llc_secondary: "LLC Secondary",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  invoice_recipient: "bg-purple-900/40 text-purple-300 border border-purple-800",
  payer: "bg-blue-900/40 text-blue-300 border border-blue-800",
  both: "bg-green-900/40 text-green-300 border border-green-800",
  llc_primary: "bg-amber-900/40 text-amber-300 border border-amber-800",
  llc_secondary: "bg-orange-900/40 text-orange-300 border border-orange-800",
};

const BLANK_ENTITY = {
  entityName: "",
  entityType: "invoice_recipient",
  entityEmail: "",
  entityPhone: "",
  isInvoiceRecipient: false,
  isPayer: false,
  billingSplitPercentage: "",
  splitOrder: "",
  notes: "",
};

const INSIGHT_TYPE_ICONS: Record<string, React.ReactNode> = {
  follow_up: <Bell size={14} />,
  upsell: <TrendingUp size={14} />,
  retention: <Heart size={14} />,
  pricing: <DollarSign size={14} />,
  risk: <AlertTriangle size={14} />,
};

const INSIGHT_TYPE_COLORS: Record<string, string> = {
  follow_up: "text-blue-400 bg-blue-900/30 border-blue-800",
  upsell: "text-green-400 bg-green-900/30 border-green-800",
  retention: "text-pink-400 bg-pink-900/30 border-pink-800",
  pricing: "text-yellow-400 bg-yellow-900/30 border-yellow-800",
  risk: "text-red-400 bg-red-900/30 border-red-800",
};

const RELIABILITY_COLORS: Record<string, string> = {
  excellent: "bg-green-900/40 text-green-300 border border-green-700",
  good: "bg-blue-900/40 text-blue-300 border border-blue-700",
  fair: "bg-yellow-900/40 text-yellow-300 border border-yellow-700",
  poor: "bg-red-900/40 text-red-300 border border-red-700",
};

const EMAIL_PURPOSES = [
  { value: "follow_up", label: "Follow-up" },
  { value: "invoice_intro", label: "Invoice Introduction" },
  { value: "payment_thanks", label: "Payment Thanks" },
  { value: "check_in", label: "Check In" },
  { value: "upsell", label: "Upsell" },
];

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Entity state
  const [entities, setEntities] = useState<any[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [entityForm, setEntityForm] = useState<any>(BLANK_ENTITY);
  const [entitySaving, setEntitySaving] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editEntityForm, setEditEntityForm] = useState<any>({});

  // Insights state
  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Invoice expansion + payment state
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [payModal, setPayModal] = useState<{ invoiceId: number; invoiceRef: string; balance: number; currency: string } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", reference: "", notes: "", sendEmail: false });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // New invoice modal state
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvForm, setNewInvForm] = useState({ projectName: "", totalAmount: "", currency: "USD", invoiceType: "standard", dueDate: "", notes: "" });
  const [newInvSaving, setNewInvSaving] = useState(false);
  const [newInvError, setNewInvError] = useState<string | null>(null);
  // Per-invoice email sending
  const [sendingEmailFor, setSendingEmailFor] = useState<number | null>(null);

  // Email draft state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailPurpose, setEmailPurpose] = useState("follow_up");
  const [emailInvoiceRef, setEmailInvoiceRef] = useState("");
  const [emailDraft, setEmailDraft] = useState<any>(null);
  const [emailDraftLoading, setEmailDraftLoading] = useState(false);
  const [emailDraftError, setEmailDraftError] = useState<string | null>(null);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSendError, setEmailSendError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/clients/${id}`);
    if (res.ok) {
      const data = await res.json();
      setClient(data);
      setForm({
        name: data.name,
        commercialName: data.commercial_name || data.name,
        llcName: data.llc_name ?? "",
        email: data.email ?? "",
        company: data.company ?? "",
        phone: data.phone ?? "",
        country: data.country ?? "",
        sinpeNumber: data.sinpe_number ?? "",
        notes: data.notes ?? "",
        preferredLanguage: data.preferred_language ?? "en",
        contactPerson: data.contact_person ?? "",
        additionalEmails: data.additional_emails ?? [],
      });
    }
    setLoading(false);
  }

  async function loadEntities() {
    setEntitiesLoading(true);
    const res = await fetch(`/api/clients/${id}/entities`);
    if (res.ok) {
      const data = await res.json();
      setEntities(data);
    }
    setEntitiesLoading(false);
  }

  useEffect(() => { load(); loadEntities(); }, [id]);

  async function save() {
    setSaving(true);
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditing(false);
    await load();
    setSaving(false);
  }

  async function deleteClient() {
    if (!confirm("Delete this client? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.push("/dashboard/clients");
  }

  async function addEntity() {
    setEntitySaving(true);
    const res = await fetch(`/api/clients/${id}/entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...entityForm,
        billingSplitPercentage: entityForm.billingSplitPercentage ? Number(entityForm.billingSplitPercentage) : null,
        splitOrder: entityForm.splitOrder ? Number(entityForm.splitOrder) : null,
      }),
    });
    if (res.ok) {
      setShowAddEntity(false);
      setEntityForm(BLANK_ENTITY);
      await loadEntities();
    }
    setEntitySaving(false);
  }

  async function saveEntityEdit(entityId: string) {
    setEntitySaving(true);
    const payload = {
      ...editEntityForm,
      billingSplitPercentage: editEntityForm.billingSplitPercentage !== "" ? Number(editEntityForm.billingSplitPercentage) : null,
      splitOrder: editEntityForm.splitOrder !== "" ? Number(editEntityForm.splitOrder) : null,
    };
    const res = await fetch(`/api/clients/${id}/entities/${entityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditingEntityId(null);
      await loadEntities();
    }
    setEntitySaving(false);
  }

  async function deleteEntity(entityId: string) {
    if (!confirm("Delete this payment entity?")) return;
    await fetch(`/api/clients/${id}/entities/${entityId}`, { method: "DELETE" });
    await loadEntities();
  }

  function startEditEntity(entity: any) {
    setEditingEntityId(entity.id);
    setEditEntityForm({
      entityName: entity.entity_name ?? "",
      entityType: entity.entity_type ?? "invoice_recipient",
      entityEmail: entity.entity_email ?? "",
      entityPhone: entity.entity_phone ?? "",
      isInvoiceRecipient: entity.is_invoice_recipient ?? false,
      isPayer: entity.is_payer ?? false,
      billingSplitPercentage: entity.billing_split_percentage ?? "",
      splitOrder: entity.split_order ?? "",
      notes: entity.notes ?? "",
    });
  }

  async function fetchInsights() {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await fetch(`/api/clients/${id}/insights`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        setInsightsError(err.error || "Failed to get insights");
      } else {
        const data = await res.json();
        setInsights(data);
      }
    } catch {
      setInsightsError("Network error");
    }
    setInsightsLoading(false);
  }

  async function generateEmailDraft() {
    setEmailDraftLoading(true);
    setEmailDraftError(null);
    try {
      const res = await fetch(`/api/clients/${id}/email-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: emailPurpose, invoiceRef: emailInvoiceRef || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        setEmailDraftError(err.error || "Failed to generate draft");
      } else {
        const data = await res.json();
        setEmailDraft(data);
      }
    } catch {
      setEmailDraftError("Network error");
    }
    setEmailDraftLoading(false);
  }

  async function sendEmail() {
    if (!emailDraft) return;
    setEmailSending(true);
    setEmailSendError(null);
    try {
      const res = await fetch(`/api/clients/${id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailDraft.subject,
          emailBody: emailDraft.body,
          lang: emailDraft.lang || "en",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setEmailSendError(err.error || "Failed to send");
      } else {
        setEmailSent(true);
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailSent(false);
          setEmailDraft(null);
        }, 2000);
      }
    } catch {
      setEmailSendError("Network error");
    }
    setEmailSending(false);
  }

  function copyToClipboard(text: string, type: "subject" | "body") {
    navigator.clipboard.writeText(text);
    if (type === "subject") {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  }

  function addAdditionalEmail() {
    setForm((f: any) => ({ ...f, additionalEmails: [...(f.additionalEmails ?? []), ""] }));
  }

  function updateAdditionalEmail(index: number, value: string) {
    setForm((f: any) => {
      const emails = [...(f.additionalEmails ?? [])];
      emails[index] = value;
      return { ...f, additionalEmails: emails };
    });
  }

  function removeAdditionalEmail(index: number) {
    setForm((f: any) => {
      const emails = [...(f.additionalEmails ?? [])];
      emails.splice(index, 1);
      return { ...f, additionalEmails: emails };
    });
  }

  async function logPayment() {
    if (!payModal) return;
    setPaying(true);
    setPayError(null);
    const res = await fetch(`/api/invoices/${payModal.invoiceId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined,
        sendEmail: payForm.sendEmail,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setPayError(err.error || "Failed to log payment");
    } else {
      setPayModal(null);
      setPayForm({ amount: "", method: "bank_transfer", reference: "", notes: "", sendEmail: false });
      await load();
    }
    setPaying(false);
  }

  async function sendInvoiceEmail(invoiceId: number, type: "invoice" | "follow_up") {
    setSendingEmailFor(invoiceId);
    await fetch(`/api/invoices/${invoiceId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    setSendingEmailFor(null);
    await load();
  }

  async function createInvoice() {
    setNewInvSaving(true);
    setNewInvError(null);
    const dueDate = newInvForm.dueDate || (() => {
      const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
    })();
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: client.commercial_name || client.name,
        clientEmail: client.email,
        clientCompany: client.llc_name || client.company,
        projectName: newInvForm.projectName,
        totalAmount: parseFloat(newInvForm.totalAmount),
        currency: newInvForm.currency,
        invoiceType: newInvForm.invoiceType,
        dueDate,
        notes: newInvForm.notes || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setNewInvError(err.error || "Failed to create invoice");
    } else {
      setShowNewInvoice(false);
      setNewInvForm({ projectName: "", totalAmount: "", currency: "USD", invoiceType: "standard", dueDate: "", notes: "" });
      await load();
    }
    setNewInvSaving(false);
  }

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;
  if (!client) return <div className="p-8 text-zinc-500">Client not found</div>;

  const enrichedInvoices = (client.invoices ?? []).map((inv: any) => {
    const total = parseFloat(inv.total_amount);
    const paid = parseFloat(inv.paid_amount ?? 0);
    const overdue = daysOverdue(inv.due_date);
    const billing = computeBillingStatus(inv.billing_status ?? "DRAFT", inv.status ?? "pending", inv.due_date, paid, total);
    return { ...inv, total, paid, overdue, billing, balance: Math.max(0, total - paid) };
  });

  const invoiceRecipients = entities.filter((e) => e.is_invoice_recipient);
  const payers = entities.filter((e) => e.is_payer);

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Clients
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{client.commercial_name || client.name}</h1>
            {client.client_ref && (
              <span className="font-mono text-xs text-green-400 bg-green-950 border border-green-800 px-2 py-0.5 rounded-md">{client.client_ref}</span>
            )}
          </div>
          {client.llc_name && client.llc_name !== (client.commercial_name || client.name) && (
            <p className="text-zinc-400 text-sm">{client.llc_name}</p>
          )}
          {!client.llc_name && client.company && <p className="text-zinc-400 text-sm">{client.company}</p>}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href={`/dashboard/clients/${id}/statement`} target="_blank">
            <Button size="sm" variant="outline" className="text-blue-400 border-blue-800 hover:bg-blue-900/30 hover:text-blue-300">
              <ClipboardList size={14} />Statement
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => { setShowEmailModal(true); setEmailDraft(null); setEmailDraftError(null); setEmailSent(false); setEmailSendError(null); }}>
            <Mail size={14} />Draft Email
          </Button>
          {editing ? (
            <>
              <Button size="sm" onClick={save} disabled={saving}><Save size={14} />{saving ? "Saving..." : "Save"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X size={14} />Cancel</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit2 size={14} />Edit</Button>
              <Button size="sm" variant="ghost" onClick={deleteClient} disabled={deleting} className="text-red-400 hover:text-red-300">Delete</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs text-zinc-400">Total Billed</p>
          <p className="text-xl font-bold text-white mt-1">{fmt(client.totalBilled)}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Total Paid</p>
          <p className="text-xl font-bold text-green-400 mt-1">{fmt(client.totalPaid)}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${client.outstanding > 0 ? "text-red-400" : "text-green-400"}`}>{fmt(client.outstanding)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Client Info</h2>
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label>Commercial Name <span className="text-zinc-500 font-normal text-xs">(brand / trade name)</span></Label>
                <Input value={form.commercialName} onChange={(e) => setForm((f: any) => ({ ...f, commercialName: e.target.value, name: e.target.value }))} placeholder="e.g. Nacho's Restaurant" />
              </div>
              <div>
                <Label>S.A. / SRL / Legal Name <span className="text-zinc-500 font-normal text-xs">(razón social)</span></Label>
                <Input value={form.llcName} onChange={(e) => setForm((f: any) => ({ ...f, llcName: e.target.value }))} placeholder="e.g. Empresa Nacional S.A." />
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
              <div>
                <Label>Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm((f: any) => ({ ...f, contactPerson: e.target.value }))} placeholder="e.g. Jane Smith" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Additional Emails</Label>
                  <button type="button" onClick={addAdditionalEmail} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                    <Plus size={11} />Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(form.additionalEmails ?? []).map((email: string, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => updateAdditionalEmail(idx, e.target.value)}
                        placeholder="additional@example.com"
                        className="flex-1"
                      />
                      <button type="button" onClick={() => removeAdditionalEmail(idx)} className="text-red-400 hover:text-red-300 p-1">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {(form.additionalEmails ?? []).length === 0 && (
                    <p className="text-xs text-zinc-600">No additional emails</p>
                  )}
                </div>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm((f: any) => ({ ...f, company: e.target.value }))} /></div>
              <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm((f: any) => ({ ...f, country: e.target.value }))} /></div>
              <div><Label>SINPE Móvil</Label><Input value={form.sinpeNumber} onChange={(e) => setForm((f: any) => ({ ...f, sinpeNumber: e.target.value }))} /></div>
              <div>
                <Label>Preferred Language</Label>
                <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500" value={form.preferredLanguage} onChange={(e) => setForm((f: any) => ({ ...f, preferredLanguage: e.target.value }))}>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div><Label>Notes</Label><textarea className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[80px] resize-y" value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {client.email && <div className="flex justify-between"><span className="text-zinc-400">Email</span><span className="text-zinc-300">{client.email}</span></div>}
              {client.contact_person && <div className="flex justify-between"><span className="text-zinc-400">Contact Person</span><span className="text-zinc-300">{client.contact_person}</span></div>}
              {client.additional_emails && client.additional_emails.length > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-400 shrink-0">Additional Emails</span>
                  <span className="text-zinc-300 text-right">{client.additional_emails.join(", ")}</span>
                </div>
              )}
              {client.phone && <div className="flex justify-between"><span className="text-zinc-400">Phone</span><span className="text-zinc-300">{client.phone}</span></div>}
              {client.country && <div className="flex justify-between"><span className="text-zinc-400">Country</span><span className="text-zinc-300">{client.country}</span></div>}
              {client.llc_name && <div className="flex justify-between"><span className="text-zinc-400">Razón Social</span><span className="text-zinc-300">{client.llc_name}</span></div>}
              {client.sinpe_number && <div className="flex justify-between"><span className="text-zinc-400">SINPE</span><span className="text-zinc-300">{client.sinpe_number}</span></div>}
              <div className="flex justify-between"><span className="text-zinc-400">Language</span><span className="text-zinc-300">{client.preferred_language === "es" ? "🇨🇷 Español" : "🇺🇸 English"}</span></div>
              {client.notes && <div className="pt-2 border-t border-zinc-800"><p className="text-zinc-400 text-xs mb-1">Notes</p><p className="text-zinc-300 text-xs">{client.notes}</p></div>}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={14} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-white">Payment Summary</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Invoices</span><span className="text-zinc-300">{enrichedInvoices.length}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Paid invoices</span><span className="text-zinc-300">{enrichedInvoices.filter((i: any) => i.billing === "PAID").length}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Open invoices</span><span className="text-zinc-300">{enrichedInvoices.filter((i: any) => i.billing !== "PAID" && i.billing !== "CANCELLED").length}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Overdue</span><span className="text-red-400">{enrichedInvoices.filter((i: any) => i.overdue > 0).length}</span></div>
          </div>
        </Card>
      </div>

      {/* Client Insights Card */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <h2 className="text-sm font-medium text-white">Client Insights</h2>
            {insights?.payment_reliability && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${RELIABILITY_COLORS[insights.payment_reliability] ?? "bg-zinc-800 text-zinc-300"}`}>
                {insights.payment_reliability}
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={fetchInsights} disabled={insightsLoading}>
            <Sparkles size={13} />
            {insightsLoading ? "Analyzing..." : insights ? "Refresh" : "Get Insights"}
          </Button>
        </div>

        {insightsError && (
          <p className="text-sm text-red-400 mb-3">{insightsError}</p>
        )}

        {insightsLoading && (
          <div className="space-y-2">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2" />
          </div>
        )}

        {!insightsLoading && !insights && !insightsError && (
          <p className="text-zinc-500 text-sm">Click "Get Insights" to have Claude analyze this client's payment history and suggest actions.</p>
        )}

        {insights && !insightsLoading && (
          <div className="space-y-4">
            {insights.relationship_summary && (
              <p className="text-sm text-zinc-300 leading-relaxed">{insights.relationship_summary}</p>
            )}

            {insights.next_action && (
              <div className="rounded-lg border border-purple-800 bg-purple-900/20 px-4 py-3">
                <p className="text-xs font-medium text-purple-400 uppercase tracking-wide mb-1">Next Action</p>
                <p className="text-sm text-white">{insights.next_action}</p>
              </div>
            )}

            {insights.recommendations && insights.recommendations.length > 0 && (
              <div className="grid gap-2">
                {insights.recommendations.slice(0, 3).map((rec: any, i: number) => (
                  <div key={i} className={`rounded-lg border p-3 ${INSIGHT_TYPE_COLORS[rec.type] ?? "text-zinc-300 bg-zinc-900/30 border-zinc-700"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {INSIGHT_TYPE_ICONS[rec.type] ?? null}
                      <span className="text-xs font-semibold uppercase tracking-wide">{rec.title}</span>
                    </div>
                    <p className="text-xs opacity-80">{rec.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Invoice History */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-white">Invoice History</h2>
            <span className="text-xs text-zinc-600">({enrichedInvoices.length})</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setShowNewInvoice(true); setNewInvError(null); }}>
            <Plus size={13} />New Invoice
          </Button>
        </div>
        {enrichedInvoices.length === 0 ? (
          <p className="text-zinc-500 text-sm">No invoices yet. Create the first one above.</p>
        ) : (
          <div className="space-y-0">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_1.5fr_auto_auto_auto_auto] gap-2 pb-2 border-b border-zinc-800 text-xs text-zinc-500 font-medium px-2">
              <span>Invoice</span>
              <span>Project</span>
              <span className="text-center w-24">Status</span>
              <span className="text-right w-20">Amount</span>
              <span className="text-right w-20">Balance</span>
              <span className="text-right w-16">Due</span>
            </div>
            {enrichedInvoices.map((inv: any) => {
              const isExpanded = expandedInvoiceId === inv.id;
              return (
                <div key={inv.id} className="border-b border-zinc-800/60 last:border-0">
                  {/* Main row */}
                  <div
                    className="grid grid-cols-[1fr_1.5fr_auto_auto_auto_auto] gap-2 py-2.5 px-2 hover:bg-zinc-900/40 cursor-pointer transition-colors items-center group"
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isExpanded ? <ChevronDown size={12} className="text-zinc-500 shrink-0" /> : <ChevronRight size={12} className="text-zinc-600 shrink-0" />}
                      <span className="font-mono text-xs text-green-400">{inv.invoice_ref || "—"}</span>
                    </div>
                    <span className="text-xs text-zinc-400 truncate">{inv.project_name || "—"}</span>
                    <div className="w-24 flex justify-center"><StatusBadge status={inv.billing} /></div>
                    <span className="text-xs text-zinc-300 text-right w-20">{fmt(inv.total, inv.currency)}</span>
                    <span className={`text-xs text-right w-20 font-medium ${inv.balance > 0 ? "text-red-400" : "text-green-400"}`}>{fmt(inv.balance, inv.currency)}</span>
                    <div className="text-right w-16">
                      <span className="text-xs text-zinc-400">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                      {inv.overdue > 0 && <div className="text-xs text-red-400">{inv.overdue}d late</div>}
                    </div>
                  </div>

                  {/* Expanded: payments + actions */}
                  {isExpanded && (
                    <div className="bg-zinc-900/60 border-t border-zinc-800/60 px-4 pb-4 pt-3">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <button
                          onClick={() => {
                            setPayModal({ invoiceId: inv.id, invoiceRef: inv.invoice_ref, balance: inv.balance, currency: inv.currency });
                            setPayForm({ amount: inv.balance > 0 ? String(inv.balance.toFixed(2)) : "", method: "bank_transfer", reference: "", notes: "", sendEmail: false });
                            setPayError(null);
                          }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-900/30 text-green-400 border border-green-800 hover:bg-green-900/50 transition-colors"
                        >
                          <Receipt size={12} />Log Payment
                        </button>
                        <button
                          onClick={() => sendInvoiceEmail(inv.id, inv.billing === "DRAFT" || inv.billing === "SENT" ? "invoice" : "follow_up")}
                          disabled={sendingEmailFor === inv.id || !client.email}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-800 hover:bg-blue-900/50 transition-colors disabled:opacity-40"
                        >
                          <Send size={12} />
                          {sendingEmailFor === inv.id ? "Sending…" : inv.billing === "DRAFT" ? "Send Invoice" : "Send Follow-up"}
                        </button>
                        <Link href={`/dashboard/invoices/${inv.id}`} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white transition-colors">
                          <ExternalLink size={12} />Full Detail
                        </Link>
                      </div>

                      {/* Payments sub-table */}
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                        Payments {inv.payments?.length > 0 ? `(${inv.payments.length})` : ""}
                      </p>
                      {!inv.payments || inv.payments.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">No payments recorded yet.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-zinc-600">
                              <th className="text-left pb-1 font-medium">Date</th>
                              <th className="text-left pb-1 font-medium">Method</th>
                              <th className="text-left pb-1 font-medium">Reference</th>
                              <th className="text-right pb-1 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.payments.map((p: any) => (
                              <tr key={p.id} className="border-t border-zinc-800/40">
                                <td className="py-1 text-zinc-400">
                                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                </td>
                                <td className="py-1 text-zinc-400 capitalize">{(p.method || "").replace(/_/g, " ")}</td>
                                <td className="py-1 text-zinc-500 font-mono">{p.reference || "—"}</td>
                                <td className="py-1 text-green-400 text-right font-medium">{fmt(parseFloat(p.amount), inv.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Payment Entities */}
      <div className="mt-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-zinc-400" />
              <h2 className="text-sm font-medium text-white">Payment Entities</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setShowAddEntity(true); setEntityForm(BLANK_ENTITY); }}>
              <Plus size={14} />Add Entity
            </Button>
          </div>

          {/* Payment Profile Summary */}
          {entities.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-sm space-y-1">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Payment Profile</p>
              <div className="flex gap-2">
                <span className="text-zinc-500 w-44 shrink-0">Invoice sent to:</span>
                <span className="text-zinc-300">
                  {invoiceRecipients.length > 0 ? invoiceRecipients.map((e) => e.entity_name).join(", ") : "—"}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-500 w-44 shrink-0">Payments expected from:</span>
                <span className="text-zinc-300">
                  {payers.length > 0
                    ? payers.map((e) => `${e.entity_name}${e.billing_split_percentage ? ` (${e.billing_split_percentage}%)` : ""}`).join(", ")
                    : "—"}
                </span>
              </div>
              {client.billing_notes && (
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-44 shrink-0">Pattern:</span>
                  <span className="text-zinc-300">{client.billing_notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Add Entity Form */}
          {showAddEntity && (
            <div className="mb-4 p-4 rounded-lg border border-zinc-700 bg-zinc-900 space-y-3">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">New Entity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Entity Name</Label>
                  <Input value={entityForm.entityName} onChange={(e) => setEntityForm((f: any) => ({ ...f, entityName: e.target.value }))} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <Label>Type</Label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={entityForm.entityType}
                    onChange={(e) => setEntityForm((f: any) => ({ ...f, entityType: e.target.value }))}
                  >
                    <option value="invoice_recipient">Invoice Recipient</option>
                    <option value="payer">Payer</option>
                    <option value="both">Both</option>
                    <option value="llc_primary">LLC Primary</option>
                    <option value="llc_secondary">LLC Secondary</option>
                  </select>
                </div>
                <div>
                  <Label>Split %</Label>
                  <Input type="number" min="0" max="100" value={entityForm.billingSplitPercentage} onChange={(e) => setEntityForm((f: any) => ({ ...f, billingSplitPercentage: e.target.value }))} placeholder="e.g. 50" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={entityForm.entityEmail} onChange={(e) => setEntityForm((f: any) => ({ ...f, entityEmail: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Input value={entityForm.notes} onChange={(e) => setEntityForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      className="accent-purple-500"
                      checked={entityForm.isInvoiceRecipient}
                      onChange={(e) => setEntityForm((f: any) => ({ ...f, isInvoiceRecipient: e.target.checked }))}
                    />
                    Receives Invoices
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      className="accent-blue-500"
                      checked={entityForm.isPayer}
                      onChange={(e) => setEntityForm((f: any) => ({ ...f, isPayer: e.target.checked }))}
                    />
                    Makes Payments
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={addEntity} disabled={entitySaving || !entityForm.entityName}>
                  <Save size={14} />{entitySaving ? "Saving..." : "Save Entity"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddEntity(false)}>
                  <X size={14} />Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Entity List */}
          {entitiesLoading ? (
            <p className="text-zinc-500 text-sm">Loading entities...</p>
          ) : entities.length === 0 && !showAddEntity ? (
            <p className="text-zinc-500 text-sm">No payment entities yet. Add one to define who receives invoices and who pays.</p>
          ) : (
            <div className="space-y-3">
              {entities.map((entity) => (
                <div key={entity.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                  {editingEntityId === entity.id ? (
                    /* Inline Edit Form */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Entity Name</Label>
                          <Input value={editEntityForm.entityName} onChange={(e) => setEditEntityForm((f: any) => ({ ...f, entityName: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <select
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                            value={editEntityForm.entityType}
                            onChange={(e) => setEditEntityForm((f: any) => ({ ...f, entityType: e.target.value }))}
                          >
                            <option value="invoice_recipient">Invoice Recipient</option>
                            <option value="payer">Payer</option>
                            <option value="both">Both</option>
                            <option value="llc_primary">LLC Primary</option>
                            <option value="llc_secondary">LLC Secondary</option>
                          </select>
                        </div>
                        <div>
                          <Label>Split %</Label>
                          <Input type="number" min="0" max="100" value={editEntityForm.billingSplitPercentage} onChange={(e) => setEditEntityForm((f: any) => ({ ...f, billingSplitPercentage: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input type="email" value={editEntityForm.entityEmail} onChange={(e) => setEditEntityForm((f: any) => ({ ...f, entityEmail: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                          <Label>Notes</Label>
                          <Input value={editEntityForm.notes} onChange={(e) => setEditEntityForm((f: any) => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
                            <input type="checkbox" className="accent-purple-500" checked={editEntityForm.isInvoiceRecipient} onChange={(e) => setEditEntityForm((f: any) => ({ ...f, isInvoiceRecipient: e.target.checked }))} />
                            Receives Invoices
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
                            <input type="checkbox" className="accent-blue-500" checked={editEntityForm.isPayer} onChange={(e) => setEditEntityForm((f: any) => ({ ...f, isPayer: e.target.checked }))} />
                            Makes Payments
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEntityEdit(entity.id)} disabled={entitySaving}>
                          <Save size={14} />{entitySaving ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingEntityId(null)}>
                          <X size={14} />Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Read-only Entity Card */
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-medium text-white text-sm">{entity.entity_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTITY_TYPE_COLORS[entity.entity_type] ?? "bg-zinc-800 text-zinc-300"}`}>
                            {ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}
                          </span>
                          {entity.billing_split_percentage != null && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {entity.billing_split_percentage}%
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 mb-2">
                          {entity.entity_email && <span>{entity.entity_email}</span>}
                          {entity.entity_phone && <span>{entity.entity_phone}</span>}
                        </div>
                        <div className="flex gap-2 flex-wrap mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${entity.is_invoice_recipient ? "bg-purple-900/30 text-purple-300 border-purple-800" : "bg-zinc-900 text-zinc-600 border-zinc-800"}`}>
                            Receives invoices
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${entity.is_payer ? "bg-blue-900/30 text-blue-300 border-blue-800" : "bg-zinc-900 text-zinc-600 border-zinc-800"}`}>
                            Makes payments
                          </span>
                        </div>
                        {entity.notes && <p className="text-xs text-zinc-500 mt-1">{entity.notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => startEditEntity(entity)} className="text-zinc-400 hover:text-white">
                          <Edit2 size={13} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteEntity(entity.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Log Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPayModal(null)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-green-400" />
                <h2 className="text-sm font-semibold text-white">Log Payment</h2>
                <span className="font-mono text-xs text-zinc-500">{payModal.invoiceRef}</span>
              </div>
              <button onClick={() => setPayModal(null)} className="text-zinc-400 hover:text-white"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-zinc-500 bg-zinc-800 rounded-lg px-3 py-2">
                Balance remaining: <span className="text-red-400 font-semibold">{fmt(payModal.balance, payModal.currency)}</span>
              </div>
              <div>
                <Label>Amount ({payModal.currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payForm.amount}
                  onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder={String(payModal.balance.toFixed(2))}
                />
              </div>
              <div>
                <Label>Payment Method</Label>
                <select
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={payForm.method}
                  onChange={(e) => setPayForm(f => ({ ...f, method: e.target.value }))}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="wire">Wire Transfer</option>
                  <option value="ach">ACH</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
              <div>
                <Label>Reference / Confirmation #</Label>
                <Input
                  value={payForm.reference}
                  onChange={(e) => setPayForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. TRF-20240419-001"
                />
              </div>
              <div>
                <Label>Notes <span className="text-zinc-600 font-normal">(optional)</span></Label>
                <Input
                  value={payForm.notes}
                  onChange={(e) => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="accent-green-500"
                  checked={payForm.sendEmail}
                  onChange={(e) => setPayForm(f => ({ ...f, sendEmail: e.target.checked }))}
                />
                Send payment confirmation email to client
              </label>
              {payError && <p className="text-sm text-red-400">{payError}</p>}
              <div className="flex gap-2 pt-1">
                <Button onClick={logPayment} disabled={paying || !payForm.amount} className="flex-1">
                  {paying ? "Saving…" : <><Check size={14} />Confirm Payment</>}
                </Button>
                <Button variant="ghost" onClick={() => setPayModal(null)}><X size={14} />Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showNewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowNewInvoice(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-zinc-400" />
                <h2 className="text-sm font-semibold text-white">New Invoice</h2>
                <span className="text-xs text-zinc-500">for {client.commercial_name || client.name}</span>
              </div>
              <button onClick={() => setShowNewInvoice(false)} className="text-zinc-400 hover:text-white"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label>Project / Service Name</Label>
                <Input
                  autoFocus
                  value={newInvForm.projectName}
                  onChange={(e) => setNewInvForm(f => ({ ...f, projectName: e.target.value }))}
                  placeholder="e.g. Marketing Retainer – May 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newInvForm.totalAmount}
                    onChange={(e) => setNewInvForm(f => ({ ...f, totalAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <select
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={newInvForm.currency}
                    onChange={(e) => setNewInvForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="USD">USD</option>
                    <option value="CRC">CRC (₡)</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Invoice Type</Label>
                  <select
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={newInvForm.invoiceType}
                    onChange={(e) => setNewInvForm(f => ({ ...f, invoiceType: e.target.value }))}
                  >
                    <option value="standard">Standard</option>
                    <option value="retainer">Retainer</option>
                    <option value="project">Project</option>
                    <option value="milestone">Milestone</option>
                  </select>
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newInvForm.dueDate}
                    onChange={(e) => setNewInvForm(f => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Notes <span className="text-zinc-600 font-normal">(optional)</span></Label>
                <Input
                  value={newInvForm.notes}
                  onChange={(e) => setNewInvForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any details for this invoice..."
                />
              </div>
              {newInvError && <p className="text-sm text-red-400">{newInvError}</p>}
              <div className="flex gap-2 pt-1">
                <Button onClick={createInvoice} disabled={newInvSaving || !newInvForm.projectName || !newInvForm.totalAmount} className="flex-1">
                  {newInvSaving ? "Creating…" : <><Plus size={14} />Create Invoice</>}
                </Button>
                <Button variant="ghost" onClick={() => setShowNewInvoice(false)}><X size={14} />Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Draft Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowEmailModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-zinc-400" />
                <h2 className="text-sm font-semibold text-white">Draft Email</h2>
                <span className="text-xs text-zinc-500">for {client.commercial_name || client.name}</span>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Label>Purpose</Label>
                <select
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={emailPurpose}
                  onChange={(e) => { setEmailPurpose(e.target.value); setEmailDraft(null); }}
                >
                  {EMAIL_PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Invoice Reference <span className="text-zinc-500 font-normal text-xs">(optional)</span></Label>
                <Input
                  value={emailInvoiceRef}
                  onChange={(e) => setEmailInvoiceRef(e.target.value)}
                  placeholder="e.g. INV-2025-001"
                />
              </div>

              <Button onClick={generateEmailDraft} disabled={emailDraftLoading} className="w-full">
                <Sparkles size={14} />
                {emailDraftLoading ? "Generating..." : "Generate Draft"}
              </Button>

              {emailDraftError && (
                <p className="text-sm text-red-400">{emailDraftError}</p>
              )}

              {emailDraft && (
                <div className="space-y-4 pt-2 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Draft</p>
                    {emailDraft.lang && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {emailDraft.lang === "es" ? "ES" : "EN"}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Subject</Label>
                      <button
                        onClick={() => copyToClipboard(emailDraft.subject, "subject")}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                      >
                        {copiedSubject ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        {copiedSubject ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <Input
                      value={emailDraft.subject}
                      onChange={(e) => setEmailDraft((d: any) => ({ ...d, subject: e.target.value }))}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Body</Label>
                      <button
                        onClick={() => copyToClipboard(emailDraft.body, "body")}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                      >
                        {copiedBody ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        {copiedBody ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <textarea
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[220px] resize-y font-mono text-xs leading-relaxed"
                      value={emailDraft.body}
                      onChange={(e) => setEmailDraft((d: any) => ({ ...d, body: e.target.value }))}
                    />
                  </div>

                  {emailSendError && (
                    <p className="text-sm text-red-400">{emailSendError}</p>
                  )}
                  <Button
                    onClick={sendEmail}
                    disabled={emailSending || emailSent}
                    className={`w-full ${emailSent ? "bg-green-600 hover:bg-green-600" : ""}`}
                  >
                    {emailSent ? (
                      <><Check size={14} /> Sent!</>
                    ) : emailSending ? (
                      "Sending…"
                    ) : (
                      <><Mail size={14} /> Send Email</>
                    )}
                  </Button>
                  <p className="text-xs text-zinc-600 text-center">
                    Sends from <span className="text-zinc-500">billing@puravidagrowth.com</span> via AXIS
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
