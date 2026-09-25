import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { role, condominium, condomini, operatore } = await getDashboardContext();

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} operatore={operatore} />
      <div className="flex flex-1 flex-col">
        <TopBar condominium={condominium} role={role} condomini={condomini} />
        {/* pb-24: il badge "Powered by Netlify" è fisso in basso a destra e
            coprirebbe i pulsanti in fondo alla pagina. */}
        <main className="flex-1 bg-muted/20 p-4 pb-24 sm:p-6 sm:pb-24">{children}</main>
      </div>
    </div>
  );
}
