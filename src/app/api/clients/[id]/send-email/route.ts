import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "AXIS <billing@updates.puravidagrowth.com>";
const REPLY_TO = "billing@puravidagrowth.com";
const BCC = "billing@updates.puravidagrowth.com";
const BILLING_EMAIL = "billing@puravidagrowth.com";

const SIGNATURE_EN = `AXIS · AI Billing Assistant<br>
<a href="mailto:${BILLING_EMAIL}" style="color:#16a34a;text-decoration:none">${BILLING_EMAIL}</a>
 · <a href="https://puravidagrowth.com" style="color:#16a34a;text-decoration:none">puravidagrowth.com</a>`;

const SIGNATURE_ES = `AXIS · Asistente de Facturación<br>
<a href="mailto:${BILLING_EMAIL}" style="color:#16a34a;text-decoration:none">${BILLING_EMAIL}</a>
 · <a href="https://puravidagrowth.com" style="color:#16a34a;text-decoration:none">puravidagrowth.com</a>`;

function buildHtml(body: string, lang: string): string {
  const sig = lang === "es" ? SIGNATURE_ES : SIGNATURE_EN;
  const htmlBody = body
    .replace(/\[SIGNATURE\]/g, sig)
    .replace(/\n/g, "<br>");

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0f1202;padding:28px 32px;text-align:center;border-bottom:3px solid #819800">
        <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:6px">
          <div style="width:40px;height:40px;background:#262d05;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="38" height="38" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <line x1="7" y1="33" x2="20" y2="9" stroke="#819800" stroke-width="4" stroke-linecap="round"/>
              <line x1="33" y1="33" x2="20" y2="9" stroke="#819800" stroke-width="4" stroke-linecap="round"/>
              <line x1="12.5" y1="25.5" x2="27.5" y2="25.5" stroke="#819800" stroke-width="3.5" stroke-linecap="round"/>
              <line x1="21" y1="25.5" x2="27.5" y2="33" stroke="#fda22c" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
              <circle cx="20" cy="9" r="2.8" fill="#fda22c"/>
            </svg>
          </div>
          <div style="text-align:left">
            <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.18em;font-family:Arial,sans-serif;line-height:1">AXIS</div>
            <div style="color:#819800;font-size:11px;font-weight:500;letter-spacing:0.06em;font-family:Arial,sans-serif;line-height:1.4">by Pura Vida Growth</div>
          </div>
        </div>
        <p style="color:#6b7280;margin:6px 0 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif">AI Billing Assistant</p>
      </div>
      <div style="padding:32px;background:#ffffff;line-height:1.7;font-size:14px">
        ${htmlBody}
      </div>
      <div style="background:#f9fafb;padding:20px 16px;text-align:center;border-top:1px solid #e5e7eb">
        <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:600">AXIS · AI Billing Assistant</p>
        <p style="margin:0;color:#9ca3af;font-size:11px">
          <a href="mailto:${BILLING_EMAIL}" style="color:#9ca3af;text-decoration:none">${BILLING_EMAIL}</a>
          &nbsp;·&nbsp;
          <a href="https://puravidagrowth.com" style="color:#9ca3af;text-decoration:none">puravidagrowth.com</a>
        </p>
      </div>
    </div>`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { subject, emailBody, lang = "en", toEmail } = body as {
    subject: string;
    emailBody: string;
    lang?: string;
    toEmail?: string;
  };

  if (!subject || !emailBody) {
    return NextResponse.json({ error: "subject and emailBody are required" }, { status: 400 });
  }

  let recipient = toEmail;
  if (!recipient) {
    const { data: client } = await db.from("clients").select("email, billing_email").eq("id", id).maybeSingle();
    recipient = (client as any)?.billing_email || (client as any)?.email;
  }

  if (!recipient) {
    return NextResponse.json({ error: "No email address found for this client" }, { status: 400 });
  }

  const html = buildHtml(emailBody, lang);

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: [recipient],
      reply_to: REPLY_TO,
      bcc: [BCC],
      subject,
      html,
    });
    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Send failed" }, { status: 500 });
  }
}
