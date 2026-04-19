"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, CheckCircle, Send, RefreshCw, Mail, Shield, ShieldCheck, ShieldOff, QrCode } from "lucide-react";

function TestEmailButton() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sendTestEmail() {
    setSending(true);
    setResult(null);
    // Find invoice 56 (PVG-TEST-001) and send email via existing route
    const res = await fetch("/api/invoices/56/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "invoice" }),
    });
    const data = await res.json();
    setResult(res.ok ? "✓ Test email sent to federico@puravidagrowth.com" : `Error: ${data.error ?? "Unknown"}`);
    setSending(false);
  }

  return (
    <div>
      <Button type="button" variant="outline" onClick={sendTestEmail} disabled={sending}>
        {sending ? <><RefreshCw size={14} className="animate-spin" />Sending…</> : <><Mail size={14} />Send Test Email Now</>}
      </Button>
      {result && (
        <p className={`mt-2 text-xs ${result.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{result}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState<{ ok: boolean; message: string; preview?: string } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings");
    setSettings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function set(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function sendDigest() {
    setSendingDigest(true);
    setDigestResult(null);
    const res = await fetch("/api/digest", { method: "POST" });
    const data = await res.json();
    setDigestResult(data);
    setSendingDigest(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Configure billing behavior and defaults</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Company</h2>
          <div className="space-y-4">
            <div>
              <Label>Company Name</Label>
              <Input value={settings.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div>
              <Label>Sender Name</Label>
              <Input value={settings.sender_name ?? ""} onChange={(e) => set("sender_name", e.target.value)} />
            </div>
            <div>
              <Label>Billing Email</Label>
              <Input type="email" value={settings.sender_email ?? ""} onChange={(e) => set("sender_email", e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Billing Defaults</h2>
          <div className="space-y-4">
            <div>
              <Label>Default Currency</Label>
              <select
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                value={settings.default_currency ?? "USD"}
                onChange={(e) => set("default_currency", e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="CRC">CRC (₡)</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <Label>Default Payment Terms (days)</Label>
              <Input type="number" min="1" value={settings.default_payment_terms_days ?? "30"} onChange={(e) => set("default_payment_terms_days", e.target.value)} />
              <p className="text-xs text-zinc-500 mt-1">Number of days after invoice date the payment is due</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Email Signature</h2>
          <div className="space-y-4">
            <div>
              <Label>Signature (plain text)</Label>
              <textarea
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[120px] resize-y font-mono"
                value={settings.email_signature ?? ""}
                onChange={(e) => set("email_signature", e.target.value)}
                placeholder={"Federico Rojas\nPura Vida Growth\nbilling@puravidagrowth.com\n+506 XXXX-XXXX"}
              />
              <p className="text-xs text-zinc-500 mt-1">Used in AI-generated email drafts. Replaces the <code className="bg-zinc-800 px-1 rounded">[SIGNATURE]</code> placeholder.</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-white mb-4">Follow-up Automation</h2>
          <div className="space-y-4">
            <div>
              <Label>Follow-up Interval (days)</Label>
              <Input type="number" min="1" value={settings.follow_up_interval_days ?? "7"} onChange={(e) => set("follow_up_interval_days", e.target.value)} />
              <p className="text-xs text-zinc-500 mt-1">Minimum days between follow-up emails to the same client</p>
            </div>
            <div>
              <Label>Due Soon Window (days)</Label>
              <Input type="number" min="1" value={settings.due_soon_window_days ?? "3"} onChange={(e) => set("due_soon_window_days", e.target.value)} />
              <p className="text-xs text-zinc-500 mt-1">Mark invoice as DUE_SOON this many days before due date</p>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : <><Save size={14} />Save Settings</>}
          </Button>
          {saved && (
            <div className="flex items-center gap-1.5 text-green-400 text-sm">
              <CheckCircle size={14} />
              Saved!
            </div>
          )}
        </div>
      </form>

      {/* Test Email */}
      <div className="mt-8 border-t border-zinc-800 pt-8">
        <h2 className="text-sm font-semibold text-white mb-1">Test Invoice Email</h2>
        <p className="text-zinc-500 text-xs mb-4">
          Sends invoice <span className="text-zinc-300 font-mono">PVG-TEST-001</span> ($100 test invoice) to <span className="text-zinc-300">federico@puravidagrowth.com</span> to verify email delivery and template rendering.
        </p>
        <TestEmailButton />
      </div>

      {/* Financial Digest */}
      <div className="mt-8 border-t border-zinc-800 pt-8">
        <h2 className="text-sm font-semibold text-white mb-1">Financial Digest</h2>
        <p className="text-zinc-500 text-xs mb-4">
          Automatically sent every Monday and Thursday at 8AM Costa Rica time to <span className="text-zinc-300">federico@puravidagrowth.com</span>.
          Powered by Claude Opus — includes invoice health, cash flow, upcoming recurring invoices, and strategic recommendations.
        </p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={sendDigest}
            disabled={sendingDigest}
          >
            {sendingDigest
              ? <><RefreshCw size={14} className="animate-spin" />Generating…</>
              : <><Send size={14} />Send Digest Now</>
            }
          </Button>
          <span className="text-xs text-zinc-500">Takes ~10–15 seconds to generate</span>
        </div>
        {digestResult && (
          <div className={`mt-4 rounded-lg p-4 text-sm ${digestResult.ok ? "bg-green-900/20 border border-green-800 text-green-300" : "bg-red-900/20 border border-red-800 text-red-400"}`}>
            {digestResult.ok ? (
              <>
                <p className="font-medium mb-2">✓ Digest sent to federico@puravidagrowth.com</p>
                {digestResult.preview && (
                  <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed border-t border-zinc-800 pt-2 mt-2 max-h-64 overflow-y-auto">
                    {digestResult.preview}
                  </pre>
                )}
              </>
            ) : (
              <p>Error: {digestResult.message}</p>
            )}
          </div>
        )}
      </div>

      {/* 2FA Setup */}
      <div className="mt-8 border-t border-zinc-800 pt-8">
        <TwoFASection />
      </div>
    </div>
  );
}

function TwoFASection() {
  const [status, setStatus] = useState<"loading" | "enabled" | "disabled">("loading");
  const [phase, setPhase] = useState<"idle" | "setup" | "confirm">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [success, setSuccess] = useState("");

  async function loadStatus() {
    const res = await fetch("/api/auth/setup-2fa");
    const data = await res.json();
    setStatus(data.enabled ? "enabled" : "disabled");
  }

  useEffect(() => { loadStatus(); }, []);

  async function startSetup() {
    setWorking(true);
    setError("");
    const res = await fetch("/api/auth/setup-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate" }),
    });
    const data = await res.json();
    setQrDataUrl(data.qrDataUrl);
    setSecret(data.secret);
    setPhase("setup");
    setWorking(false);
  }

  async function confirmSetup() {
    if (code.length !== 6) return;
    setWorking(true);
    setError("");
    const res = await fetch("/api/auth/setup-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", secret, code }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus("enabled");
      setPhase("idle");
      setSuccess("2FA enabled! Google Authenticator is now required on every login.");
      setTimeout(() => setSuccess(""), 5000);
    } else {
      setError(data.error || "Invalid code, try again");
    }
    setCode("");
    setWorking(false);
  }

  async function disable2FA() {
    if (!confirm("Disable two-factor authentication? The app will only require your password.")) return;
    setWorking(true);
    await fetch("/api/auth/setup-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable" }),
    });
    setStatus("disabled");
    setPhase("idle");
    setWorking(false);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Shield size={14} className="text-blue-400" />
        <h2 className="text-sm font-semibold text-white">Two-Factor Authentication (2FA)</h2>
        {status === "enabled" && (
          <span className="inline-flex items-center gap-1 bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-800">
            <ShieldCheck size={10} /> Active
          </span>
        )}
        {status === "disabled" && (
          <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-500 text-xs px-2 py-0.5 rounded-full">
            <ShieldOff size={10} /> Not enabled
          </span>
        )}
      </div>
      <p className="text-zinc-500 text-xs mb-4">
        Require a Google Authenticator code after your password on every login.
      </p>

      {success && (
        <div className="mb-4 bg-green-900/20 border border-green-800 text-green-300 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      {status === "loading" && <p className="text-zinc-600 text-xs">Loading…</p>}

      {status === "enabled" && phase === "idle" && (
        <Button variant="outline" onClick={disable2FA} disabled={working} className="text-red-400 border-red-900 hover:bg-red-900/20">
          <ShieldOff size={14} /> Disable 2FA
        </Button>
      )}

      {status === "disabled" && phase === "idle" && (
        <Button variant="outline" onClick={startSetup} disabled={working}>
          <QrCode size={14} /> {working ? "Generating…" : "Enable Google Authenticator"}
        </Button>
      )}

      {phase === "setup" && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-sm">
          <p className="text-sm font-medium text-white mb-1">Scan with Google Authenticator</p>
          <p className="text-xs text-zinc-400 mb-4">
            Open the Google Authenticator app, tap <strong className="text-zinc-300">+</strong> → <strong className="text-zinc-300">Scan a QR code</strong>, then point your camera at this code.
          </p>
          {qrDataUrl && (
            <div className="bg-white rounded-lg p-3 inline-block mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="2FA QR Code" width={200} height={200} />
            </div>
          )}
          <p className="text-xs text-zinc-500 mb-1">Manual entry key (if camera doesn&apos;t work):</p>
          <p className="font-mono text-xs text-zinc-300 bg-zinc-900 rounded-lg px-3 py-2 mb-4 break-all select-all">{secret}</p>

          <p className="text-xs text-zinc-400 mb-2">Enter the 6-digit code from the app to verify:</p>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center tracking-widest font-mono"
              autoFocus
            />
            <Button onClick={confirmSetup} disabled={working || code.length !== 6}>
              {working ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Confirm
            </Button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <button
            onClick={() => { setPhase("idle"); setCode(""); setError(""); }}
            className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
