import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "PVG AXIS <billing@updates.puravidagrowth.com>";
const REPLY_TO = "billing@puravidagrowth.com";
const BCC = "billing@updates.puravidagrowth.com";
const BILLING_EMAIL = "billing@puravidagrowth.com";

const SIGNATURE_EN = `PVG AXIS · AI Billing Assistant<br><a href="mailto:${BILLING_EMAIL}" style="color:#819800;text-decoration:none">${BILLING_EMAIL}</a> · <a href="https://puravidagrowth.com" style="color:#819800;text-decoration:none">puravidagrowth.com</a>`;
const SIGNATURE_ES = `PVG AXIS · Asistente de Facturación<br><a href="mailto:${BILLING_EMAIL}" style="color:#819800;text-decoration:none">${BILLING_EMAIL}</a> · <a href="https://puravidagrowth.com" style="color:#819800;text-decoration:none">puravidagrowth.com</a>`;

function buildHtml(body: string, lang: string): string {
  const sig = lang === "es" ? SIGNATURE_ES : SIGNATURE_EN;
  const htmlBody = body.replace(/\[SIGNATURE\]/g, sig).replace(/\n/g, "<br>");

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0f1202;padding:28px 32px;text-align:center;border-bottom:3px solid #819800">
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
          <tr>
            <td width="46" height="46" style="background:#262d05;border-radius:8px;text-align:center;vertical-align:middle">
              <span style="color:#819800;font-size:26px;font-weight:900;line-height:46px;display:block;font-family:Arial,sans-serif">A</span>
            </td>
            <td style="padding-left:12px;vertical-align:middle">
              <div style="color:#ffffff;font-size:21px;font-weight:800;letter-spacing:3px;font-family:Arial,sans-serif;line-height:1.1">PVG AXIS</div>
              <div style="color:#819800;font-size:10px;font-weight:600;letter-spacing:1px;font-family:Arial,sans-serif;margin-top:2px">by Pura Vida Growth</div>
            </td>
          </tr>
        </table>
        <p style="color:#6b7280;margin:10px 0 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif">AI Billing Assistant</p>
      </div>
      <div style="padding:32px;background:#ffffff;line-height:1.7;font-size:14px">
        ${htmlBody}
      </div>
      <div style="background:#f9fafb;padding:20px 16px;text-align:center;border-top:3px solid #819800">
        <p style="margin:0;color:#262d05;font-size:13px;font-weight:800;letter-spacing:3px;font-family:Arial,sans-serif">PVG AXIS</p>
        <p style="margin:2px 0 6px;color:#819800;font-size:10px;font-weight:600;font-family:Arial,sans-serif">by Pura Vida Growth</p>
        <p style="margin:0;font-size:11px;font-family:Arial,sans-serif">
          <a href="mailto:${BILLING_EMAIL}" style="color:#819800;text-decoration:none">${BILLING_EMAIL}</a>
          &nbsp;·&nbsp;
          <a href="https://puravidagrowth.com" style="color:#819800;text-decoration:none">puravidagrowth.com</a>
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
      replyTo: REPLY_TO,
      bcc: [BCC],
      subject,
      html,
    });
    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Send failed" }, { status: 500 });
  }
}
