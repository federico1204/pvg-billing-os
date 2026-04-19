"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity } from "lucide-react";

const ACTION_ICONS: Record<string, string> = {
  created: "📄",
  sent: "📧",
  follow_up_sent: "🔔",
  payment_recorded: "💰",
  status_updated: "🔄",
  paid: "✅",
  cancelled: "❌",
  disputed: "⚠️",
};

interface ActivityEntry {
  id: number;
  invoice_id: number;
  action: string;
  description: string;
  performed_by: string;
  created_at: string;
  invoices: { invoice_ref: string; client_name: string } | null;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/activity?limit=${limit}`);
    setActivities(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [limit]);

  const grouped: Record<string, ActivityEntry[]> = {};
  for (const a of activities) {
    const day = new Date(a.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(a);
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Log</h1>
          <p className="text-zinc-400 text-sm mt-0.5">All billing system events</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}><RefreshCw size={14} />Refresh</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20">
          <Activity size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500">No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([day, entries]) => (
            <div key={day}>
              <p className="text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">{day}</p>
              <div className="space-y-2">
                {entries.map((a) => (
                  <div key={a.id} className="flex gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <span className="text-lg leading-none mt-0.5">{ACTION_ICONS[a.action] ?? "•"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-zinc-200">{a.description}</p>
                        <span className="text-xs text-zinc-500 shrink-0">
                          {new Date(a.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      {a.invoices && (
                        <div className="flex items-center gap-2 mt-1">
                          <Link href={`/dashboard/invoices/${a.invoice_id}`} className="text-xs text-green-400 hover:text-green-300 font-mono">{a.invoices.invoice_ref}</Link>
                          <span className="text-xs text-zinc-500">·</span>
                          <span className="text-xs text-zinc-500">{a.invoices.client_name}</span>
                        </div>
                      )}
                      <p className="text-xs text-zinc-600 mt-0.5">by {a.performed_by}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {activities.length >= limit && (
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + 100)}>Load more</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
