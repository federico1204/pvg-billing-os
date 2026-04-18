"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Play, AlertCircle, Info, TrendingUp } from "lucide-react";
import type { MonitorReport, MonitorAction } from "@/lib/ai";
import { fmt } from "@/lib/utils";

const PRIORITY_COLORS = { HIGH: "text-red-400 bg-red-900/30", MEDIUM: "text-yellow-400 bg-yellow-900/30", LOW: "text-blue-400 bg-blue-900/30" };
const TYPE_ICONS: Record<string, string> = { SEND_INVOICE: "📄", SEND_FOLLOWUP: "📧", ESCALATE: "🚨", VERIFY_PAYMENT: "🏦", MARK_DISPUTED: "⚠️", ALERT: "ℹ️" };

export default function MonitorPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MonitorReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runMonitor() {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/monitor", { method: "POST" });
      if (!res.ok) { setError("Failed to run monitor"); setLoading(false); return; }
      setReport(await res.json());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const byPriority = report
    ? {
        HIGH: report.actions.filter((a) => a.priority === "HIGH"),
        MEDIUM: report.actions.filter((a) => a.priority === "MEDIUM"),
        LOW: report.actions.filter((a) => a.priority === "LOW"),
      }
    : null;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-900 flex items-center justify-center">
          <Bot size={20} className="text-purple-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Invoice Monitor</h1>
          <p className="text-zinc-400 text-sm">Claude Haiku analyzes all open invoices and returns a prioritized action plan</p>
        </div>
      </div>

      <Button onClick={runMonitor} disabled={loading} size="lg" className="mb-8">
        <Play size={16} />{loading ? "Analyzing..." : "Run Monitor"}
      </Button>

      {error && (
        <Card className="border-red-900 bg-red-950/30 mb-6">
          <div className="flex items-center gap-2 text-red-400"><AlertCircle size={16} />{error}</div>
        </Card>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-xs text-zinc-400">Outstanding</p>
              <p className="text-xl font-bold text-red-400 mt-1">{fmt(report.totalOutstanding)}</p>
            </Card>
            <Card>
              <p className="text-xs text-zinc-400">Overdue</p>
              <p className="text-xl font-bold text-orange-400 mt-1">{fmt(report.totalOverdue)}</p>
              <p className="text-xs text-zinc-500 mt-1">{report.overdueCount} invoice{report.overdueCount !== 1 ? "s" : ""}</p>
            </Card>
            <Card>
              <p className="text-xs text-zinc-400">Actions Needed</p>
              <p className="text-xl font-bold text-white mt-1">{report.actions.length}</p>
            </Card>
          </div>

          <Card>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-purple-400" />
              <h2 className="text-sm font-medium text-white">AI Analysis</h2>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">{report.summary}</p>
          </Card>

          {report.insights.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Info size={16} className="text-blue-400" />
                <h2 className="text-sm font-medium text-white">Insights</h2>
              </div>
              <ul className="space-y-1">
                {report.insights.map((i, idx) => <li key={idx} className="text-zinc-300 text-sm flex gap-2"><span className="text-zinc-500">•</span>{i}</li>)}
              </ul>
            </Card>
          )}

          {byPriority && (
            <Card>
              <h2 className="text-sm font-medium text-white mb-4">Actions ({report.actions.length})</h2>
              <div className="space-y-6">
                {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => {
                  const actions = byPriority[priority];
                  if (!actions.length) return null;
                  return (
                    <div key={priority}>
                      <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${priority === "HIGH" ? "text-red-400" : priority === "MEDIUM" ? "text-yellow-400" : "text-blue-400"}`}>
                        {priority === "HIGH" ? "🔴" : priority === "MEDIUM" ? "🟡" : "🟢"} {priority} Priority
                      </p>
                      <div className="space-y-2">
                        {actions.map((a, i) => (
                          <div key={i} className={`rounded-lg p-3 ${PRIORITY_COLORS[a.priority]}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span>{TYPE_ICONS[a.type] || "•"}</span>
                                  <span className="text-sm font-medium text-white">{a.type}</span>
                                  <span className="font-mono text-xs text-zinc-400">{a.invoiceRef}</span>
                                  <span className="text-xs text-zinc-400">— {a.clientName}</span>
                                </div>
                                <p className="text-xs text-zinc-300 mt-1 ml-6">{a.reasoning}</p>
                                {a.suggestedMessage && <p className="text-xs text-zinc-500 mt-1 ml-6 italic">💬 {a.suggestedMessage}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <p className="text-xs text-zinc-600 text-right">Run at {new Date(report.runAt).toLocaleString("en-US", { timeZone: "America/Costa_Rica" })} (Costa Rica)</p>
        </div>
      )}
    </div>
  );
}
