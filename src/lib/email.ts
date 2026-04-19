import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// PVG AXIS — AI Billing Assistant for Pura Vida Growth
// Sends from verified Resend subdomain; clients reply to billing@puravidagrowth.com
const FROM = "PVG AXIS <billing@updates.puravidagrowth.com>";
const REPLY_TO = "billing@puravidagrowth.com";
const BCC = "billing@updates.puravidagrowth.com";
const BILLING_EMAIL = "billing@puravidagrowth.com";
const WEBSITE = "puravidagrowth.com";

interface InvoiceEmailData {
  clientName: string;
  clientEmail: string;
  invoiceRef: string;
  projectName?: string | null;
  totalAmount: string;
  dueDate: string;
  currency: string;
  notes?: string | null;
  lang?: string; // "en" | "es"
}

function emailLogo(): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
      <tr>
        <td width="46" height="46" style="background:#262d05;border-radius:8px;text-align:center;vertical-align:middle;font-family:Arial,sans-serif">
          <span style="color:#819800;font-size:26px;font-weight:900;line-height:46px;display:block">A</span>
        </td>
        <td style="padding-left:12px;vertical-align:middle">
          <div style="color:#ffffff;font-size:21px;font-weight:800;letter-spacing:3px;font-family:Arial,sans-serif;line-height:1.1">PVG AXIS</div>
          <div style="color:#819800;font-size:10px;font-weight:600;letter-spacing:1px;font-family:Arial,sans-serif;margin-top:2px">by Pura Vida Growth</div>
        </td>
      </tr>
    </table>`;
}

function emailHeader(subtitle: string, urgent = false): string {
  const bg = urgent ? "#3b0a0a" : "#0f1202";
  const accentBar = urgent ? "#f94300" : "#819800";
  return `
    <div style="background:${bg};padding:28px 32px;text-align:center;border-bottom:3px solid ${accentBar}">
      ${emailLogo()}
      <p style="color:#6b7280;margin:10px 0 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif">${subtitle}</p>
    </div>`;
}

function emailFooter(lang: string): string {
  const es = lang === "es";
  return `
    <div style="background:#f9fafb;padding:20px 16px;text-align:center;border-top:3px solid #819800">
      <p style="margin:0;color:#262d05;font-size:13px;font-weight:800;letter-spacing:3px;font-family:Arial,sans-serif">PVG AXIS</p>
      <p style="margin:2px 0 6px;color:#819800;font-size:10px;font-weight:600;font-family:Arial,sans-serif">by Pura Vida Growth</p>
      <p style="margin:0;font-size:11px;font-family:Arial,sans-serif">
        <a href="mailto:${BILLING_EMAIL}" style="color:#819800;text-decoration:none">${BILLING_EMAIL}</a>
        &nbsp;·&nbsp;
        <a href="https://${WEBSITE}" style="color:#819800;text-decoration:none">${WEBSITE}</a>
      </p>
      <p style="margin:6px 0 0;color:#9ca3af;font-size:10px;font-family:Arial,sans-serif">
        ${es
          ? "Este mensaje fue generado automáticamente. No comparta esta información con terceros."
          : "This message was generated automatically. Please do not share this information with third parties."}
      </p>
    </div>`;
}

function paymentInstructionsHtml(invoiceRef: string, lang: string): string {
  const es = lang === "es";
  return `
    <p style="margin:0 0 10px;font-weight:bold;color:#15803d">${es ? "Instrucciones de Pago" : "Payment Instructions"}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#374151">
      ${es ? "Transferencia bancaria internacional / Wire transfer:" : "International wire transfer:"}
    </p>
    <table style="font-size:13px;color:#374151;border-collapse:collapse;width:100%">
      <tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap">${es ? "Banco" : "Bank"}</td><td style="font-weight:600">BAC San José</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap">${es ? "Beneficiario" : "Beneficiary"}</td><td style="font-weight:600">Pura Vida Growth Innovation Sociedad Anónima</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap">IBAN / Account</td><td style="font-weight:600;font-family:monospace">CR92 0102 0000 9548 7763 51</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap">SWIFT / BIC</td><td style="font-weight:600;font-family:monospace">BACCCRSX</td></tr>
    </table>
    <div style="margin-top:12px;padding:10px 12px;background:#fef9c3;border-radius:6px;border-left:3px solid #ca8a04">
      <p style="margin:0;font-size:13px;color:#854d0e">
        <strong>⚠️ ${es ? "Importante:" : "Important:"}</strong>
        ${es
          ? `En el campo <em>concepto / descripción</em> del pago, incluya: <strong style="font-family:monospace">${invoiceRef}</strong> o el nombre de su empresa. Esto nos permite identificar su pago de inmediato.`
          : `In the transfer <em>reference / description</em> field, please include: <strong style="font-family:monospace">${invoiceRef}</strong> or your company name. This allows us to identify your payment immediately.`
        }
      </p>
    </div>`;
}

async function send(to: string, subject: string, html: string) {
  return getResend().emails.send({
    from: FROM,
    to: [to],
    reply_to: REPLY_TO,
    bcc: [BCC],
    subject,
    html,
  });
}

export async function sendInvoiceEmail(data: InvoiceEmailData) {
  const es = data.lang === "es";
  const lang = data.lang ?? "en";
  const paymentBlock = paymentInstructionsHtml(data.invoiceRef, lang);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      ${emailHeader(es ? `Factura ${data.invoiceRef}` : `Invoice ${data.invoiceRef}`)}
      <div style="padding:32px;background:#ffffff">
        <p>${es ? `Hola ${data.clientName},` : `Hi ${data.clientName},`}</p>
        <p>${es
          ? `Le enviamos los detalles de su factura${data.projectName ? ` por <strong>${data.projectName}</strong>` : ""}.`
          : `Please find your invoice details below${data.projectName ? ` for <strong>${data.projectName}</strong>` : ""}.`
        }</p>
        <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#6b7280;padding:4px 0">${es ? "Factura" : "Invoice"}</td><td style="text-align:right;font-weight:bold;font-family:monospace">${data.invoiceRef}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">${es ? "Monto" : "Amount"}</td><td style="text-align:right;font-weight:bold;color:#16a34a;font-size:20px">${data.totalAmount}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">${es ? "Fecha límite" : "Due Date"}</td><td style="text-align:right">${data.dueDate}</td></tr>
          </table>
        </div>
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:4px;margin:24px 0">
          ${paymentBlock}
        </div>
        ${data.notes ? `<p style="color:#374151"><strong>${es ? "Notas" : "Notes"}:</strong> ${data.notes}</p>` : ""}
        <p style="color:#374151">${es
          ? `Si tiene alguna consulta, responda a este correo o escríbanos a <a href="mailto:${BILLING_EMAIL}" style="color:#16a34a">${BILLING_EMAIL}</a>.`
          : `Questions? Reply to this email or reach us at <a href="mailto:${BILLING_EMAIL}" style="color:#16a34a">${BILLING_EMAIL}</a>.`
        }</p>
        <p style="color:#374151">${es ? "¡Gracias por su preferencia!" : "Thank you for your business!"}</p>
      </div>
      ${emailFooter(lang)}
    </div>`;

  return send(
    data.clientEmail,
    es ? `Factura ${data.invoiceRef} — ${data.totalAmount}` : `Invoice ${data.invoiceRef} — ${data.totalAmount}`,
    html,
  );
}

export async function sendFollowUpEmail(data: InvoiceEmailData & { daysOverdue: number; followUpCount: number }) {
  const isUrgent = data.daysOverdue >= 14;
  const es = data.lang === "es";
  const lang = data.lang ?? "en";
  const paymentBlock = paymentInstructionsHtml(data.invoiceRef, lang);

  const subject = es
    ? (isUrgent ? `[URGENTE] Factura ${data.invoiceRef} — ${data.daysOverdue} días de atraso` : `Recordatorio: Factura ${data.invoiceRef}`)
    : (isUrgent ? `[URGENT] Invoice ${data.invoiceRef} — ${data.daysOverdue} days overdue` : `Friendly reminder: Invoice ${data.invoiceRef} due`);

  const subtitle = isUrgent
    ? (es ? "Aviso de Pago Urgente" : "Urgent Payment Notice")
    : (es ? "Recordatorio de Pago" : "Payment Reminder");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      ${emailHeader(subtitle, isUrgent)}
      <div style="padding:32px;background:#ffffff">
        <p>${es ? `Hola ${data.clientName},` : `Hi ${data.clientName},`}</p>
        <p>${es
          ? (isUrgent
            ? `Le comunicamos que la factura <strong style="font-family:monospace">${data.invoiceRef}</strong> tiene <strong>${data.daysOverdue} días de atraso</strong>. Se requiere atención inmediata.`
            : `Le recordamos que la factura <strong style="font-family:monospace">${data.invoiceRef}</strong>${data.daysOverdue > 0 ? ` tiene ${data.daysOverdue} día${data.daysOverdue !== 1 ? "s" : ""} de atraso` : " está próxima a vencer"}.`)
          : (isUrgent
            ? `We're reaching out regarding invoice <strong style="font-family:monospace">${data.invoiceRef}</strong> which is now <strong>${data.daysOverdue} days overdue</strong>. Immediate attention is required.`
            : `This is a friendly reminder that invoice <strong style="font-family:monospace">${data.invoiceRef}</strong>${data.daysOverdue > 0 ? ` is ${data.daysOverdue} day${data.daysOverdue !== 1 ? "s" : ""} overdue` : " is coming due soon"}.`)
        }</p>
        <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#6b7280;padding:4px 0">${es ? "Factura" : "Invoice"}</td><td style="text-align:right;font-weight:bold;font-family:monospace">${data.invoiceRef}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">${es ? "Monto pendiente" : "Amount Due"}</td><td style="text-align:right;font-weight:bold;color:${isUrgent ? "#dc2626" : "#16a34a"};font-size:20px">${data.totalAmount}</td></tr>
          </table>
        </div>
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:4px;margin:24px 0">
          ${paymentBlock}
        </div>
        <p style="color:#374151">${es
          ? `Si ya realizó el pago, por favor ignore este mensaje o responda con su comprobante. Si tiene alguna consulta, contáctenos en <a href="mailto:${BILLING_EMAIL}" style="color:#16a34a">${BILLING_EMAIL}</a>.`
          : `If you've already sent payment, please disregard this message or reply with your confirmation. Questions? Contact us at <a href="mailto:${BILLING_EMAIL}" style="color:#16a34a">${BILLING_EMAIL}</a>.`
        }</p>
      </div>
      ${emailFooter(lang)}
    </div>`;

  return send(data.clientEmail, subject, html);
}

export async function sendPaymentConfirmedEmail(data: InvoiceEmailData & { isPartial?: boolean; balanceRemaining?: string }) {
  const lang = data.lang ?? "en";
  const es = data.lang === "es";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      ${emailHeader(data.isPartial
        ? (es ? "Pago Parcial Recibido" : "Partial Payment Received")
        : (es ? "Pago Confirmado" : "Payment Confirmed")
      )}
      <div style="padding:32px;background:#ffffff">
        <p>${es ? `Hola ${data.clientName},` : `Hi ${data.clientName},`}</p>
        <p>${data.isPartial
          ? (es
            ? `Hemos recibido su pago parcial de la factura <strong>${data.invoiceRef}</strong>. El saldo pendiente es <strong>${data.balanceRemaining}</strong>.`
            : `We've received your partial payment for invoice <strong>${data.invoiceRef}</strong>. The remaining balance is <strong>${data.balanceRemaining}</strong>.`)
          : (es
            ? `Hemos recibido el pago completo de la factura <strong>${data.invoiceRef}</strong>. ¡Muchas gracias!`
            : `We've received full payment for invoice <strong>${data.invoiceRef}</strong>. Thank you!`)
        }</p>
        <div style="background:#f0fdf4;border-radius:8px;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0;color:#15803d;font-size:18px;font-weight:bold">
            ${data.isPartial ? (es ? "Pago parcial registrado" : "Partial payment recorded") : (es ? "✓ Factura pagada completamente" : "✓ Invoice fully paid")}
          </p>
          ${data.isPartial ? `<p style="margin:8px 0 0;color:#6b7280">${es ? "Saldo pendiente" : "Balance remaining"}: ${data.balanceRemaining}</p>` : ""}
        </div>
        <p style="color:#374151">${es ? "¡Gracias por su preferencia!" : "Thank you for your business!"}</p>
      </div>
      ${emailFooter(lang)}
    </div>`;

  return send(
    data.clientEmail,
    es
      ? `Pago ${data.isPartial ? "recibido" : "confirmado"} — Factura ${data.invoiceRef}`
      : `Payment ${data.isPartial ? "received" : "confirmed"} — Invoice ${data.invoiceRef}`,
    html,
  );
}
