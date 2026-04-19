import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { PrivacyProvider } from "@/contexts/privacy";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <PrivacyProvider>
      <div className="flex min-h-screen">
        <Nav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </PrivacyProvider>
  );
}
