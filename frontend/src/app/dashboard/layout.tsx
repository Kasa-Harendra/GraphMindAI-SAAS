import Sidebar from "@/components/layout/Sidebar";
import StoreHydration from "@/components/StoreHydration";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <StoreHydration>
      <div className="flex h-full aurora-bg grid-overlay">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </StoreHydration>
  );
}
