"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AxisIcon } from "@/components/axis-logo";
import {
  Sparkles, Send, AlertTriangle, TrendingUp, Info, X, RefreshCw,
  CalendarClock, Play, Pause, Zap, CheckCircle, ChevronDown, ChevronUp,
  MessageSquare, Brain, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ObsType = "issue" | "opportunity" | "info";
type Severity = "high" | "medium" | "low";

interface Observation {
  id: number;
  type: ObsType;
  severity: Severity;
  category: string;
  title: string;
  detail: string | null;
  related_client: string | null;
  action_suggested: string | null;
  created_at: string;
}

interface Routine {
  id: number;
  name: string;
  description: string | null;
  routine_type: string;
  frequency: string;
  is_active: boolean;
  last_run_at: string | null;
  last_result: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const OBS_ICONS: Record<ObsType, React.ReactNode> = {
  issue: <AlertTriangle size={14} />,
  opportunity: <TrendingUp size={14} />,
  info: <Info size={14} />,
};

const OBS_COLORS: Record<ObsType, Record<Severity, string>> = {
  issue: {
    high: "border-red-800 bg-red-950/30 text-red-400",
    medium: "border-orange-800 bg-orange-950/20 text-orange-400",
    low: "border-yellow-800 bg-yellow-950/20 text-yellow-400",
  },
  opportunity: {
    high: "border-green-800 bg-green-950/30 text-green-400",
    medium: "border-emerald-800 bg-emerald-950/20 text-emerald-400",
    low: "border-teal-800 bg-teal-950/20 text-teal-400",
  },
  info: {
    high: "border-blue-800 bg-blue-950/30 text-blue-400",
    medium: "border-blue-800/60 bg-blue-950/20 text-blue-400",
    low: "border-zinc-700 bg-zinc-900/40 text-zinc-400",
  },
};

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const SUGGESTED_QUESTIONS = [
  "What's our cash flow situation this month?",
  "Which clients are most at risk?",
  "Any invoices I should prioritize following up on today?",
  "Analyze Grupo AVA's payment pattern",
  "What's our net margin YTD?",
  "Which clients should I consider for a price increase?",
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgentPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [runningRoutine, setRunningRoutine] = useState<number | null>(null);
  const [showRoutines, setShowRoutines] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/agent");
    const data = await res.json();
    setObservations(data.observations ?? []);
    setRoutines(data.routines ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);

    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);

    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        conversationId,
        messages: messages, // send history
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
      setConversationId(data.conversationId ?? conversationId);
    } else {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I ran into an error. Please try again." }]);
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    const res = await fetch("/api/agent/analyze", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setObservations(data.observations ?? []);
    }
    setAnalyzing(false);
  }

  async function dismissObservation(id: number) {
    setObservations(obs => obs.filter(o => o.id !== id));
    await fetch("/api/agent/observations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function toggleRoutine(routine: Routine) {
    setRoutines(rs => rs.map(r => r.id === routine.id ? { ...r, is_active: !r.is_active } : r));
    await fetch("/api/agent/routines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: routine.id, isActive: !routine.is_active }),
    });
  }

  async function runRoutineNow(routine: Routine) {
    setRunningRoutine(routine.id);
    // All routines currently map to full analysis
    await runAnalysis();
    setRoutines(rs => rs.map(r => r.id === routine.id
      ? { ...r, last_run_at: new Date().toISOString(), last_result: "Ran successfully" }
      : r));
    setRunningRoutine(null);
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const highIssues = observations.filter(o => o.type === "issue" && o.severity === "high");
  const opportunities = observations.filter(o => o.type === "opportunity");
  const rest = observations.filter(o => !(o.type === "issue" && o.severity === "high") && o.type !== "opportunity");

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* LEFT: Observations */}
      <div className="w-[380px] shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-purple-400" />
              <h2 className="text-sm font-semibold text-white">Agent Feed</h2>
              {observations.length > 0 && (
                <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded-full">
                  {observations.length}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={runAnalysis}
              disabled={analyzing}
              className="text-xs h-7"
            >
              {analyzing
                ? <><RefreshCw size={11} className="animate-spin" />Analyzing…</>
                : <><Sparkles size={11} />Run Analysis</>}
            </Button>
          </div>
          <p className="text-xs text-zinc-600">
            {observations.length === 0
              ? "No observations yet. Click Run Analysis to start."
              : `Last updated ${observations[0] ? timeAgo(observations[0].created_at) : "—"}`}
          </p>
        </div>

        {/* Observations list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-900 rounded-lg animate-pulse" />)}
            </div>
          )}

          {!loading && observations.length === 0 && (
            <div className="text-center py-12">
              <Bot size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-medium">No observations yet</p>
              <p className="text-zinc-700 text-xs mt-1">Run an analysis to see financial insights</p>
              <Button size="sm" variant="outline" onClick={runAnalysis} disabled={analyzing} className="mt-4 text-xs">
                <Sparkles size={11} />Run First Analysis
              </Button>
            </div>
          )}

          {/* High issues first */}
          {highIssues.length > 0 && (
            <>
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wide px-1 pt-1">🔴 Critical Issues</p>
              {highIssues.map(obs => (
                <ObsCard key={obs.id} obs={obs} onDismiss={dismissObservation} onAsk={(q) => sendMessage(q)} />
              ))}
            </>
          )}

          {opportunities.length > 0 && (
            <>
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wide px-1 pt-1">🟢 Opportunities</p>
              {opportunities.map(obs => (
                <ObsCard key={obs.id} obs={obs} onDismiss={dismissObservation} onAsk={(q) => sendMessage(q)} />
              ))}
            </>
          )}

          {rest.length > 0 && (
            <>
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wide px-1 pt-1">ℹ️ Observations</p>
              {rest.map(obs => (
                <ObsCard key={obs.id} obs={obs} onDismiss={dismissObservation} onAsk={(q) => sendMessage(q)} />
              ))}
            </>
          )}
        </div>

        {/* Routines toggle */}
        <div className="border-t border-zinc-800">
          <button
            onClick={() => setShowRoutines(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CalendarClock size={13} className="text-zinc-500" />
              <span className="text-xs font-medium text-zinc-400">Routines ({routines.filter(r => r.is_active).length} active)</span>
            </div>
            {showRoutines ? <ChevronDown size={13} className="text-zinc-600" /> : <ChevronUp size={13} className="text-zinc-600" />}
          </button>
          {showRoutines && (
            <div className="border-t border-zinc-800 space-y-0 max-h-64 overflow-y-auto">
              {routines.map(routine => (
                <div key={routine.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-300 truncate">{routine.name}</p>
                    <p className="text-xs text-zinc-600">{FREQ_LABELS[routine.frequency] ?? routine.frequency}
                      {routine.last_run_at && ` · Last: ${timeAgo(routine.last_run_at)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => runRoutineNow(routine)}
                    disabled={runningRoutine === routine.id || !routine.is_active}
                    className="p-1 text-zinc-500 hover:text-green-400 transition-colors disabled:opacity-30"
                    title="Run now"
                  >
                    {runningRoutine === routine.id
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <Zap size={12} />}
                  </button>
                  <button
                    onClick={() => toggleRoutine(routine)}
                    className={cn("p-1 transition-colors", routine.is_active ? "text-green-500 hover:text-zinc-500" : "text-zinc-600 hover:text-green-400")}
                    title={routine.is_active ? "Pause" : "Resume"}
                  >
                    {routine.is_active ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        {/* Chat header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-900/40 border border-purple-800 flex items-center justify-center">
              <AxisIcon size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">AXIS Financial Agent</p>
              <p className="text-xs text-zinc-500">Full access to invoices, expenses, clients, and payments</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={startNewChat} className="text-xs text-zinc-500 hover:text-white">
            <MessageSquare size={13} />New Chat
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center pb-10">
              <div className="w-14 h-14 rounded-2xl bg-purple-900/30 border border-purple-800/50 flex items-center justify-center mb-4">
                <AxisIcon size={28} />
              </div>
              <h3 className="text-white font-semibold mb-1">Ask AXIS anything</h3>
              <p className="text-zinc-500 text-sm mb-6 max-w-xs">
                I have live access to all your invoices, expenses, client data, and payment history.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-purple-900/40 border border-purple-800/50 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                  <AxisIcon size={14} />
                </div>
              )}
              <div className={cn(
                "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-green-900/40 border border-green-800/50 text-white rounded-br-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm"
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-purple-900/40 border border-purple-800/50 flex items-center justify-center mr-2 shrink-0">
                <AxisIcon size={14} />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 pb-6 pt-3 shrink-0 border-t border-zinc-800">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about cash flow, clients, invoices, strategy…"
              disabled={sending}
              className="flex-1 bg-zinc-900 border-zinc-700"
              autoFocus
            />
            <Button type="submit" disabled={sending || !input.trim()} className="shrink-0">
              {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </form>
          <p className="text-xs text-zinc-700 mt-2 text-center">
            AXIS has live access to all financial data · Responses use Claude Opus
          </p>
        </div>
      </div>
    </div>
  );
}

function ObsCard({ obs, onDismiss, onAsk }: {
  obs: Observation;
  onDismiss: (id: number) => void;
  onAsk: (q: string) => void;
}) {
  const colorClass = OBS_COLORS[obs.type]?.[obs.severity] ?? "border-zinc-700 bg-zinc-900 text-zinc-400";
  return (
    <div className={cn("rounded-lg border p-3 relative group", colorClass)}>
      <button
        onClick={() => onDismiss(obs.id)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300"
      >
        <X size={12} />
      </button>
      <div className="flex items-start gap-2 pr-4">
        <span className="mt-0.5 shrink-0">{OBS_ICONS[obs.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white leading-snug mb-0.5">{obs.title}</p>
          {obs.related_client && (
            <p className="text-xs opacity-70 mb-0.5">{obs.related_client}</p>
          )}
          {obs.detail && (
            <p className="text-xs opacity-60 leading-relaxed">{obs.detail}</p>
          )}
          {obs.action_suggested && (
            <button
              onClick={() => onAsk(`Tell me more about this: ${obs.title}. ${obs.action_suggested}`)}
              className="mt-1.5 text-xs underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity text-left"
            >
              Ask agent →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
