"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "destructive" | "success";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-green-600 hover:bg-green-500 text-white": variant === "default",
            "hover:bg-white/10 text-zinc-300": variant === "ghost",
            "border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white bg-transparent": variant === "outline",
            "bg-red-600 hover:bg-red-500 text-white": variant === "destructive",
            "bg-emerald-700 hover:bg-emerald-600 text-white": variant === "success",
            "text-xs px-2.5 py-1.5 gap-1": size === "sm",
            "text-sm px-4 py-2 gap-2": size === "md",
            "text-base px-6 py-3 gap-2": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
