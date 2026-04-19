"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, ChevronDown, ChevronUp, Info } from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

const VARIABLES = ["{{invoice_ref}}", "{{client_name}}", "{{project_name}}", "{{amount}}", "{{balance}}", "{{due_date}}", "{{days_overdue}}", "{{payment_instructions}}"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, Template>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data);
    const map: Record<string, Template> = {};
    for (const t of data) map[t.id] = { ...t };
    setEditing(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(id: string) {
    setSaving(id);
    const t = editing[id];
    await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: t.name, subject: t.subject, body: t.body }),
    });
    setSaving(null);
    setSavedIds(prev => [...prev, id]);
    setTimeout(() => setSavedIds(prev => prev.filter(x => x !== id)), 2500);
  }

  function updateField(id: string, field: keyof Template, value: string) {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Email Templates</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Customize the emails sent to clients. Variables are replaced automatically.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Info size={14} className="text-zinc-400" />
          <p className="text-sm text-zinc-400 font-medium">Available variables</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map(v => (
            <code key={v} className="text-xs bg-zinc-800 text-green-400 px-2 py-0.5 rounded font-mono">{v}</code>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {templates.map((t) => {
          const isOpen = expanded === t.id;
          const ed = editing[t.id] ?? t;
          const isSaved = savedIds.includes(t.id);

          return (
            <Card key={t.id}>
              <button
                onClick={() => setExpanded(isOpen ? null : t.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">{t.id}</span>
                    <span className="text-sm font-medium text-white">{ed.name}</span>
                  </div>
                  {!isOpen && <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-lg">{ed.subject}</p>}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-zinc-400 shrink-0" /> : <ChevronDown size={16} className="text-zinc-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                  <div>
                    <Label>Template Name</Label>
                    <Input value={ed.name} onChange={(e) => updateField(t.id, "name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Subject Line</Label>
                    <Input value={ed.subject} onChange={(e) => updateField(t.id, "subject", e.target.value)} />
                  </div>
                  <div>
                    <Label>Body</Label>
                    <textarea
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[200px] resize-y font-mono"
                      value={ed.body}
                      onChange={(e) => updateField(t.id, "body", e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="sm" onClick={() => save(t.id)} disabled={saving === t.id}>
                      <Save size={14} />{saving === t.id ? "Saving..." : "Save Template"}
                    </Button>
                    {isSaved && <span className="text-green-400 text-xs">Saved!</span>}
                    <span className="text-xs text-zinc-600 ml-auto">
                      Updated {new Date(t.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
