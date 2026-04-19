"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Bot, LogOut, Users, Receipt, Activity,
  Settings, Mail, FolderDown, Brain, Briefcase, Landmark, CalendarClock,
  UserCheck, Eye, EyeOff, BookOpen, CreditCard,
} from "lucide-react";
import { usePrivacy } from "@/contexts/privacy";
import { AxisIcon } from "@/components/axis-logo";

const links = [
  { href: "/dashboard",            label: "Overview",       icon: LayoutDashboard, exact: true },
  { href: "/dashboard/invoices",   label: "Invoices",       icon: FileText },
  { href: "/dashboard/recurring",  label: "Recurring",      icon: CalendarClock },
  { href: "/dashboard/clients",    label: "Clients",        icon: Users },
  { href: "/dashboard/team",       label: "Team",           icon: UserCheck },
  { href: "/dashboard/expenses",      label: "Expenses",       icon: Receipt },
  { href: "/dashboard/credit-cards", label: "Credit Cards",   icon: CreditCard },
  { href: "/dashboard/vendors",       label: "Vendors",        icon: Briefcase },
  { href: "/dashboard/bank",          label: "Bank",           icon: Landmark },
  { href: "/dashboard/drive",      label: "Drive Import",   icon: FolderDown },
  { href: "/dashboard/monitor",    label: "AI Monitor",     icon: Bot },
  { href: "/dashboard/activity",   label: "Activity",       icon: Activity },
  { href: "/dashboard/templates",  label: "Email Templates", icon: Mail },
  { href: "/dashboard/intelligence", label: "Intelligence", icon: Brain },
  { href: "/dashboard/sops",       label: "SOPs",           icon: BookOpen },
  { href: "/dashboard/settings",   label: "Settings",       icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isPrivate, toggle } = usePrivacy();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className="w-56 min-h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AxisIcon size={32} />
            <div>
              <p className="text-sm font-bold text-white tracking-widest leading-tight">PVG AXIS</p>
              <p className="text-[10px] text-[#819800] font-medium leading-tight">by Pura Vida Growth</p>
            </div>
          </div>
          {/* Privacy toggle */}
          <button
            onClick={toggle}
            title={isPrivate ? "Show numbers" : "Hide numbers (presentation mode)"}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
              isPrivate
                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
            )}
          >
            {isPrivate ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        {isPrivate && (
          <p className="text-[10px] text-amber-400/70 mt-2 leading-tight">
            🔒 Numbers hidden
          </p>
        )}
      </div>

      <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 w-full transition-colors"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </nav>
  );
}
