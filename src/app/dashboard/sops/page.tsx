"use client";
import { useEffect, useState } from "react";
import { BookOpen, Plus, Edit3, Trash2, X, Check, ChevronDown, ChevronRight, FileText, Zap, Calendar, DollarSign, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  operations: { label: "Operations", color: "text-blue-400" },
  billing:    { label: "Billing",    color: "text-green-400" },
  finance:    { label: "Finance",    color: "text-yellow-400" },
  clients:    { label: "Clients",    color: "text-purple-400" },
  team:       { label: "Team",       color: "text-orange-400" },
  general:    { label: "General",    color: "text-zinc-400" },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([v, { label }]) => ({ value: v, label }));

interface SOP {
  id: number;
  title: string;
  slug: string;
  content: string;
  category: string;
  sort_order: number;
  updated_at: string;
}

function renderContent(text: string) {
  // Minimal markdown-like rendering
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-white mt-6 mb-2 first:mt-0">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold text-white mt-5 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold text-zinc-300 mt-4 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return <li key={i} className="text-sm text-zinc-300 ml-4 list-disc leading-relaxed">{line.slice(2)}</li>;
    }
    if (line.match(/^\d+\. /)) {
      return <li key={i} className="text-sm text-zinc-300 ml-4 list-decimal leading-relaxed">{line.replace(/^\d+\. /, "")}</li>;
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="text-sm font-semibold text-white mt-3">{line.slice(2, -2)}</p>;
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    // Inline bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-sm text-zinc-400 leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j} className="text-zinc-200">{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    );
  });
}

function SOPCard({ doc, onEdit, onDelete }: { doc: SOP; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_LABELS[doc.category] ?? CATEGORY_LABELS.general;
  const updatedDate = new Date(doc.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <FileText size={15} className="text-zinc-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">{doc.title}</p>
            <p className={`text-xs ${cat.color} mt-0.5`}>{cat.label} · Updated {updatedDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
            <Edit3 size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-700 transition-colors">
            <Trash2 size={13} />
          </button>
          {open ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-5">
          <div className="prose-sm max-w-none">
            {renderContent(doc.content)}
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({
  doc, onClose, onSave,
}: {
  doc: Partial<SOP> | null;
  onClose: () => void;
  onSave: (data: Partial<SOP>) => void;
}) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [category, setCategory] = useState(doc?.category ?? "general");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title, content, category, sort_order: doc?.sort_order ?? 0 });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">{doc?.id ? "Edit Document" : "New Document"}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Weekly Billing Checklist" autoFocus />
          </div>
          <div>
            <Label>Category</Label>
            <select
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Content (supports # headers, ## subheaders, - bullet lists, **bold**)</Label>
            <textarea
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[320px] resize-y font-mono leading-relaxed"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={"# Title\n\n## Section\n\n- Step one\n- Step two\n\n## Notes\n\nWrite your SOP here..."}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-zinc-800">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : <><Check size={14} /> Save</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SOPsPage() {
  const [docs, setDocs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SOP> | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    const res = await fetch("/api/sops");
    setDocs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: Partial<SOP>) {
    if (editing?.id) {
      await fetch(`/api/sops/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/sops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setShowModal(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/sops/${id}`, { method: "DELETE" });
    load();
  }

  // Group by category
  const grouped = docs.reduce((acc, doc) => {
    const cat = doc.category ?? "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, SOP[]>);

  const categoryOrder = ["operations", "billing", "finance", "clients", "team", "general"];

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={22} className="text-blue-400" />
            SOPs &amp; Playbooks
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Standard operating procedures, checklists, and process docs</p>
        </div>
        <Button onClick={() => { setEditing({}); setShowModal(true); }}>
          <Plus size={14} /> New Document
        </Button>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <BookOpen size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 mb-4">No documents yet. Add your first SOP or playbook.</p>
          <Button onClick={() => { setEditing({}); setShowModal(true); }}>
            <Plus size={14} /> Add Document
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {categoryOrder.map(cat => {
            const catDocs = grouped[cat];
            if (!catDocs?.length) return null;
            const { label, color } = CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.general;
            return (
              <div key={cat}>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${color}`}>{label}</p>
                <div className="space-y-2">
                  {catDocs.map(doc => (
                    <SOPCard
                      key={doc.id}
                      doc={doc}
                      onEdit={() => { setEditing(doc); setShowModal(true); }}
                      onDelete={() => handleDelete(doc.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <EditModal
          doc={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
