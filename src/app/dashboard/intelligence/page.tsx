"use client";
import { useEffect, useState } from "react";
import { Brain, TrendingUp, AlertTriangle, Zap, ChevronDown, ChevronUp, RefreshCw, DollarSign, Target, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/utils";

type Report = {
  health_score: number;
  health_label: string;
  executive_summary: string;
  top_3_actions: Array<{ priority: number; action: string; why: string; potential_impact: string; do_this: string }>;
  cash_flow_forecast: { next_30_days_in: number; next_30_days_out: number; next_30_days_net?: number; commentary: string };
  revenue_opportunities: Array<{ client: string; opportunity: string; approach: string; estimated_value: string }>;
  risk_flags: Array<{ type: string; client: string; description: string; urgency: string }>;
  pricing_insights: string[];
  expense_insights: string[];
  this_week_priorities: string[];
};

type Snapshot = { id: number; snapshot_date: string; report_json: Report | null };

export default function IntelligencePage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/intelligence/latest");
    if (res.ok) {
      const data = await res.json();
      setSnapshot(data);
    }
    setLoading(false);
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/intelligence/analyze", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSnapshot({ id: 0, snapshot_date: new Date().toISOString().split("T")[0], report_json: data });
      }
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const report = snapshot?.report_json;

  const scoreColor = (s: number) => s >= 75 ? "text-green-400" : s >= 50 ? "text-yellow-400" : s >= 25 ? "text-orange-400" : "text-red-400";
  const scoreBg = (s: number) => s >= 75 ? "border-green-700 bg-green-950/30" : s >= 50 ? "border-yellow-700 bg-yellow-950/30" : s >= 25 ? "border-orange-700 bg-orange-950/30" : "border-red-700 bg-red-950/30";
  const urgencyColor = (u: string) => u === "high" ? "text-red-400 bg-red-950" : u === "medium" ? "text-orange-400 bg-orange-950" : "text-yellow-400 bg-yellow-950";

  if (loading) {
    return <div className="p-8 text-zinc-500 flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-700 flex items-center justify-center">
            <Brain size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Financial Intelligence</h1>
            {snapshot?.snapshot_date && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Last analyzed: {new Date(snapshot.snapshot_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
        <Button onClick={analyze} disabled={analyzing} className="bg-indigo-600 hover:bg-indigo-500 gap-2">
          {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Brain size={14} />}
          {analyzing ? "Analyzing (30s)..." : "Analyze Now"}
        </Button>
      </div>

      {!report ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-16 text-center">
          <Brain size={48} className="text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Analysis Yet</h2>
          <p className="text-zinc-400 mb-6 max-w-md mx-auto">Run your first financial analysis to get AI-powered insights about your cash flow, client risks, and revenue opportunities.</p>
          <Button onClick={analyze} disabled={analyzing} className="bg-indigo-600 hover:bg-indigo-500">
            {analyzing ? "Analyzing..." : "Run First Analysis"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Health Score */}
          <div className={`border rounded-xl p-6 ${scoreBg(report.health_score)}`}>
            <div className="flex items-start gap-6">
              <div className="text-center shrink-0">
                <div className={`text-6xl font-bold ${scoreColor(report.health_score)}`}>{report.health_score}</div>
                <div className="text-zinc-500 text-sm">/100</div>
                <div className={`text-sm font-semibold mt-1 ${scoreColor(report.health_score)}`}>{report.health_label}</div>
              </div>
              <div className="flex-1">
                <p className="text-zinc-200 text-sm leading-relaxed">{report.executive_summary}</p>
              </div>
            </div>
          </div>

          {/* This Week Priorities */}
          {report.this_week_priorities?.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Zap size={14} className="text-yellow-400" /> This Week&apos;s Priorities</h2>
              <div className="space-y-2">
                {report.this_week_priorities.map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-yellow-900 text-yellow-300 text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
                    <span className="text-sm text-zinc-200">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-column grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Cash Flow */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><DollarSign size={14} className="text-green-400" /> Cash Flow (30 Days)</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Coming in</span>
                  <span className="text-green-400 font-medium">{fmt(report.cash_flow_forecast.next_30_days_in)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Going out</span>
                  <span className="text-red-400 font-medium">{fmt(report.cash_flow_forecast.next_30_days_out)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-2 mt-2">
                  <span className="text-zinc-300 font-medium">Net</span>
                  <span className={`font-bold ${(report.cash_flow_forecast.next_30_days_net ?? report.cash_flow_forecast.next_30_days_in - report.cash_flow_forecast.next_30_days_out) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmt(report.cash_flow_forecast.next_30_days_net ?? report.cash_flow_forecast.next_30_days_in - report.cash_flow_forecast.next_30_days_out)}
                  </span>
                </div>
              </div>
              {report.cash_flow_forecast.commentary && (
                <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{report.cash_flow_forecast.commentary}</p>
              )}
            </div>

            {/* Revenue Opportunities */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-green-400" /> Opportunities</h2>
              {report.revenue_opportunities?.length === 0 ? (
                <p className="text-xs text-zinc-500">No opportunities identified yet.</p>
              ) : (
                <div className="space-y-3">
                  {report.revenue_opportunities?.slice(0, 3).map((opp, i) => (
                    <div key={i} className="border border-zinc-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-white">{opp.client}</span>
                        <span className="text-xs text-green-400 font-medium">{opp.estimated_value}</span>
                      </div>
                      <p className="text-xs text-zinc-300 mb-1">{opp.opportunity}</p>
                      <p className="text-xs text-zinc-500 italic">{opp.approach}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risk Flags */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><ShieldAlert size={14} className="text-red-400" /> Risk Flags</h2>
              {report.risk_flags?.length === 0 ? (
                <p className="text-xs text-zinc-500">No risk flags — looking good.</p>
              ) : (
                <div className="space-y-2">
                  {report.risk_flags?.slice(0, 4).map((flag, i) => (
                    <div key={i} className={`rounded-lg p-2.5 ${urgencyColor(flag.urgency)}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold">{flag.client || flag.type}</span>
                        <span className="text-xs opacity-70 uppercase tracking-wide">{flag.urgency}</span>
                      </div>
                      <p className="text-xs opacity-80">{flag.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top 3 Actions */}
          {report.top_3_actions?.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Target size={14} className="text-indigo-400" /> Top Actions</h2>
              <div className="space-y-3">
                {report.top_3_actions.map((action, i) => (
                  <div key={i} className="border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 text-xs flex items-center justify-center shrink-0 font-bold">{action.priority}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{action.action}</p>
                        <p className="text-xs text-zinc-400 mt-1">{action.why}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-green-400">Impact: {action.potential_impact}</span>
                          <span className="text-xs text-indigo-300">→ {action.do_this}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible sections */}
          {report.pricing_insights?.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <button onClick={() => setPricingOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors">
                <span className="flex items-center gap-2"><TrendingUp size={14} className="text-indigo-400" /> Pricing Insights</span>
                {pricingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {pricingOpen && (
                <div className="px-5 pb-4 space-y-2">
                  {report.pricing_insights.map((insight, i) => (
                    <p key={i} className="text-xs text-zinc-300 flex items-start gap-2"><span className="text-indigo-400 shrink-0">•</span>{insight}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {report.expense_insights?.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <button onClick={() => setExpenseOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors">
                <span className="flex items-center gap-2"><DollarSign size={14} className="text-red-400" /> Expense Insights</span>
                {expenseOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expenseOpen && (
                <div className="px-5 pb-4 space-y-2">
                  {report.expense_insights.map((insight, i) => (
                    <p key={i} className="text-xs text-zinc-300 flex items-start gap-2"><span className="text-red-400 shrink-0">•</span>{insight}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
