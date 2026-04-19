import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const BILLING_STATUSES = [
  "DRAFT", "SENT", "DUE_SOON", "DUE_TODAY", "OVERDUE",
  "CLIENT_REPLIED", "PROOF_RECEIVED", "WAITING_BANK",
  "PARTIALLY_PAID", "PAID", "DISPUTED", "CANCELLED",
] as const;

export type BillingStatus = typeof BILLING_STATUSES[number];

export const STATUS_LABELS: Record<BillingStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  DUE_SOON: "Due Soon",
  DUE_TODAY: "Due Today",
  OVERDUE: "Overdue",
  CLIENT_REPLIED: "Client Replied",
  PROOF_RECEIVED: "Proof Received",
  WAITING_BANK: "Waiting Bank",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  DISPUTED: "Disputed",
  CANCELLED: "Cancelled",
};

export const STATUS_COLORS: Record<BillingStatus, string> = {
  DRAFT: "bg-zinc-800 text-zinc-300",
  SENT: "bg-blue-900 text-blue-200",
  DUE_SOON: "bg-yellow-900 text-yellow-200",
  DUE_TODAY: "bg-orange-900 text-orange-200",
  OVERDUE: "bg-red-900 text-red-300",
  CLIENT_REPLIED: "bg-purple-900 text-purple-200",
  PROOF_RECEIVED: "bg-cyan-900 text-cyan-200",
  WAITING_BANK: "bg-indigo-900 text-indigo-200",
  PARTIALLY_PAID: "bg-lime-900 text-lime-200",
  PAID: "bg-green-900 text-green-300",
  DISPUTED: "bg-rose-900 text-rose-300",
  CANCELLED: "bg-zinc-900 text-zinc-500",
};

export function computeBillingStatus(
  existing: string,
  status: string,
  dueDate: string | Date,
  paidAmount: number,
  totalAmount: number
): BillingStatus {
  const locked: BillingStatus[] = ["CLIENT_REPLIED", "PROOF_RECEIVED", "WAITING_BANK", "DISPUTED", "CANCELLED", "PARTIALLY_PAID"];
  if (locked.includes(existing as BillingStatus)) return existing as BillingStatus;
  if (status === "paid" || paidAmount >= totalAmount) return "PAID";
  if (status === "cancelled") return "CANCELLED";
  if (paidAmount > 0 && paidAmount < totalAmount) return "PARTIALLY_PAID";

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000);

  if (diff < 0) return "OVERDUE";
  if (diff === 0) return "DUE_TODAY";
  if (diff <= 5) return "DUE_SOON";
  return existing as BillingStatus || "DRAFT";
}

export function daysOverdue(dueDate: string | Date): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - due.getTime()) / 86400000);
}

export function fmt(amount: number, currency = "USD"): string {
  if (currency === "CRC") return `₡${Math.round(amount).toLocaleString("en-US")}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function nextInvoiceRef(lastRef?: string | null): string {
  const year = new Date().getFullYear();
  if (!lastRef) return `PVG-${year}-001`;
  const match = lastRef.match(/PVG-(\d{4})-(\d+)/);
  if (!match || parseInt(match[1]) !== year) return `PVG-${year}-001`;
  return `PVG-${year}-${String(parseInt(match[2]) + 1).padStart(3, "0")}`;
}
