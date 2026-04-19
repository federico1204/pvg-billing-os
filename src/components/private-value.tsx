"use client";
import { usePrivacy } from "@/contexts/privacy";
import { cn } from "@/lib/utils";

interface PrivateValueProps {
  value: string | number;
  className?: string;
  maskWith?: string;
}

/** Renders a financial value that respects the global privacy toggle. */
export function PrivateValue({ value, className, maskWith = "••••••" }: PrivateValueProps) {
  const { isPrivate } = usePrivacy();
  return (
    <span className={cn(isPrivate ? "select-none tracking-widest text-zinc-600" : "", className)}>
      {isPrivate ? maskWith : value}
    </span>
  );
}
