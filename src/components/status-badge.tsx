import { cn, STATUS_LABELS, STATUS_COLORS, BillingStatus } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const s = status as BillingStatus;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", STATUS_COLORS[s] ?? "bg-zinc-800 text-zinc-400")}>
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}
