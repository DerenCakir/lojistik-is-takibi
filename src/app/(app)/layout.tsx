import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import AppBackground from "@/components/AppBackground";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Kenar menüdeki rozetler için sayımlar
  const [openJobs, upcomingEvents] = await Promise.all([
    db.job.count({ where: { status: { not: "TAMAMLANDI" } } }),
    db.event.count({ where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  return (
    <div className="app">
      <AppBackground />
      <Sidebar user={user} counts={{ openJobs, upcomingEvents }} />
      <main className="main">{children}</main>
    </div>
  );
}
