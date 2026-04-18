import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Pura Vida Growth <billing@puravidagrowth.com>";

const SINPE_DEFAULT = "8888-8888";

interface InvoiceEmailData {
  clientName: string;
  clientEmail: string;
  invoiceRef: string;
  projectName?: string | null;
  totalAmount: string;
  dueDate: string;
  currency: string;
  sinpeNumber?: string | null;
  notes?: string | null;
}

function paymentInstructions(currency: string, sinpe?: string | null): string {
  if (currency === "USD") {
    return `Bank transfer details:\n  BAC San José — USD Account\n  Account: 912345678\n  SWIFT: BACCCRSX\n  Name: Pura Vida Growth`;
  }
  return `SINPE Móvil: ${sinpe || SINPE_DEFAULT} — Federico Rojas / Pura Vida Growth`;
}

export async function sendInvoiceEmail(data: InvoiceEmailData) {
  const paymentInfo = paymentInstructions(data.currency, data.sinpeNumber);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0d0d0d;padding:32px;text-align:center">
        <h1 style="color:#22c55e;margin:0;font-size:24px">Pura Vida Growth</h1>
        <p style="color:#6b7280;margin:8px 0 0">Invoice ${data.invoiceRef}</p>
      </div>
      <div style="padding:32px;background:#ffffff">
        <p>Hi ${data.clientName},</p>
        <p>Please find your invoice details below${data.projectName ? ` for <strong>${data.projectName}</strong>` : ""}.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#6b7280;padding:4px 0">Invoice</td><td style="text-align:right;font-weight:bold">${data.invoiceRef}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Amount</td><td style="text-align:right;font-weight:bold;color:#16a34a;font-size:20px">${data.totalAmount}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Due Date</td><td style="text-align:right">${data.dueDate}</td></tr>
          </table>
        </div>
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:4px;margin:24px 0">
          <p style="margin:0 0 8px;font-weight:bold;color:#15803d">Payment Instructions</p>
          <pre style="margin:0;font-family:monospace;font-size:14px;white-space:pre-wrap">${paymentInfo}</pre>
        </div>
        ${data.notes ? `<p style="color:#374151"><strong>Notes:</strong> ${data.notes}</p>` : ""}
        <p>Thank you for your business!</p>
      </div>
      <div style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:12px">
        Pura Vida Growth · billing@puravidagrowth.com · Costa Rica
      </div>
    </div>`;

  return resend.emails.send({
    from: FROM,
    to: [data.clientEmail],
    subject: `Invoice ${data.invoiceRef} — ${data.totalAmount}`,
    html,
  });
}

export async function sendFollowUpEmail(data: InvoiceEmailData & { daysOverdue: number; followUpCount: number }) {
  const isUrgent = data.daysOverdue >= 14;
  const paymentInfo = paymentInstructions(data.currency, data.sinpeNumber);
  const subject = isUrgent
    ? `[URGENT] Invoice ${data.invoiceRef} — ${data.daysOverdue} days overdue`
    : `Friendly reminder: Invoice ${data.invoiceRef} due`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:${isUrgent ? "#7f1d1d" : "#0d0d0d"};padding:32px;text-align:center">
        <h1 style="color:#22c55e;margin:0;font-size:24px">Pura Vida Growth</h1>
        <p style="color:#d1d5db;margin:8px 0 0">${isUrgent ? "Urgent Payment Notice" : "Payment Reminder"}</p>
      </div>
      <div style="padding:32px;background:#ffffff">
        <p>Hi ${data.clientName},</p>
        <p>${isUrgent
          ? `We're reaching out regarding invoice <strong>${data.invoiceRef}</strong> which is now <strong>${data.daysOverdue} days overdue</strong>. Immediate attention is required.`
          : `This is a friendly reminder that invoice <strong>${data.invoiceRef}</strong>${data.daysOverdue > 0 ? ` is ${data.daysOverdue} day${data.daysOverdue !== 1 ? "s" : ""} overdue` : " is coming due soon"}.`
        }</p>
        <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#6b7280;padding:4px 0">Invoice</td><td style="text-align:right;font-weight:bold">${data.invoiceRef}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Amount Due</td><td style="text-align:right;font-weight:bold;color:${isUrgent ? "#dc2626" : "#16a34a"};font-size:20px">${data.totalAmount}</td></tr>
          </table>
        </div>
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:4px;margin:24px 0">
          <p style="margin:0 0 8px;font-weight:bold;color:#15803d">Payment Instructions</p>
          <pre style="margin:0;font-family:monospace;font-size:14px;white-space:pre-wrap">${paymentInfo}</pre>
        </div>
        <p>If you have questions, please reply to this email.</p>
      </div>
      <div style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:12px">
        Pura Vida Growth · billing@puravidagrowth.com · Costa Rica
      </div>
    </div>`;

  return resend.emails.send({ from: FROM, to: [data.clientEmail], subject, html });
}

export async function sendPaymentConfirmedEmail(data: InvoiceEmailData & { isPartial?: boolean; balanceRemaining?: string }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#052e16;padding:32px;text-align:center">
        <h1 style="color:#22c55e;margin:0;font-size:24px">Pura Vida Growth</h1>
        <p style="color:#86efac;margin:8px 0 0">${data.isPartial ? "Partial Payment Received" : "Payment Confirmed"}</p>
      </div>
      <div style="padding:32px;background:#ffffff">
        <p>Hi ${data.clientName},</p>
        <p>${data.isPartial
          ? `We've received your partial payment for invoice <strong>${data.invoiceRef}</strong>. The remaining balance is <strong>${data.balanceRemaining}</strong>.`
          : `We've received full payment for invoice <strong>${data.invoiceRef}</strong>. Thank you!`
        }</p>
        <div style="background:#f0fdf4;border-radius:8px;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0;color:#15803d;font-size:18px;font-weight:bold">${data.isPartial ? "Partial payment recorded" : "✓ Invoice fully paid"}</p>
          ${data.isPartial ? `<p style="margin:8px 0 0;color:#6b7280">Balance remaining: ${data.balanceRemaining}</p>` : ""}
        </div>
        <p>Thanks for working with Pura Vida Growth!</p>
      </div>
      <div style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:12px">
        Pura Vida Growth · billing@puravidagrowth.com · Costa Rica
      </div>
    </div>`;

  return resend.emails.send({
    from: FROM,
    to: [data.clientEmail],
    subject: `Payment ${data.isPartial ? "received" : "confirmed"} — Invoice ${data.invoiceRef}`,
    html,
  });
}
