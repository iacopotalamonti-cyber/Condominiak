import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { role, condominium } = await getDashboardContext();

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col">
        <TopBar condominium={condominium} role={role} />
        <main className="flex-1 bg-muted/20 p-6">{children}</main>
      </div>
    </div>
  );
}
