import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { visibleJobsWhere } from "@/lib/jobs";
import Icon from "@/components/Icon";
import QuickTask from "./QuickTask";
import { statusInfo, fmtDate, fmtDateLong, daysUntilLabel, daysUntil } from "@/lib/constants";

type VJob = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assigneeId: string | null;
  assignee: { name: string } | null;
  support: { id: string }[];
};

function JobLine({ j }: { j: VJob }) {
  const st = statusInfo(j.status);
  const overdue = j.dueDate && daysUntil(j.dueDate) < 0;
  return (
    <Link href={`/isler/${j.id}`} className="item" style={{ display: "block" }}>
      <div className="title" style={{ fontSize: 14 }}>{j.title}</div>
      <div className="meta">
        <span className={`status-pill ${st.cls}`}>{st.label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icon name="user" size={13} /> {j.assignee?.name ?? "Atanmadı"}
        </span>
        {j.dueDate && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(overdue ? { color: "var(--red)", fontWeight: 600 } : {}) }}>
            <Icon name="calendar" size={13} /> {daysUntilLabel(j.dueDate)}
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [visibleJobs, upcomingEvents, users] = await Promise.all([
    db.job.findMany({
      where: visibleJobsWhere(user),
      select: {
        id: true, title: true, status: true, priority: true, dueDate: true, assigneeId: true,
        assignee: { select: { name: true } },
        support: { select: { id: true } },
      },
    }),
    db.event.findMany({
      where: { date: { gte: todayStart } },
      orderBy: { date: "asc" },
      take: 4,
      include: { tasks: { select: { done: true } } },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const active = visibleJobs.filter((j) => j.status !== "TAMAMLANDI");
  const openCount = visibleJobs.filter((j) => j.status === "BEKLEMEDE").length;
  const doingCount = visibleJobs.filter((j) => j.status === "DEVAM").length;
  const doneCount = visibleJobs.filter((j) => j.status === "TAMAMLANDI").length;
  const overdueCount = active.filter((j) => j.dueDate && daysUntil(j.dueDate) < 0).length;

  const byDue = (a: VJob, b: VJob) =>
    (a.dueDate ? a.dueDate.getTime() : Infinity) - (b.dueDate ? b.dueDate.getTime() : Infinity);
  const priorityJobs = active.filter((j) => j.priority === "YUKSEK").sort(byDue).slice(0, 6);
  const upcomingDue = active.filter((j) => j.dueDate).sort(byDue).slice(0, 6);

  const perPerson = users
    .map((u) => ({
      name: u.name,
      open: active.filter((j) => j.assigneeId === u.id).length,
      done: visibleJobs.filter((j) => j.assigneeId === u.id && j.status === "TAMAMLANDI").length,
      support: active.filter((j) => j.support.some((s) => s.id === u.id)).length,
    }))
    .sort((a, b) => b.open - a.open);
  const unassigned = active.filter((j) => !j.assigneeId).length;

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Merhaba, {user.name.split(" ")[0]}</h2>
          <div className="sub">{fmtDateLong(new Date())}</div>
        </div>
      </div>

      <div className="content">
        <div className="stats">
          <div className="stat"><div className="k">Bekleyen iş</div><div className="v">{openCount}</div></div>
          <div className="stat"><div className="k">Devam eden</div><div className="v">{doingCount}</div></div>
          <div className="stat"><div className="k">Tamamlanan</div><div className="v">{doneCount}</div></div>
          <div className="stat">
            <div className="k">Gecikmiş</div>
            <div className="v" style={overdueCount > 0 ? { color: "var(--red)" } : undefined}>{overdueCount}</div>
          </div>
        </div>

        <div className="panel-grid">
          <div>
            <div className="card">
              <h3 style={{ justifyContent: "space-between" }}>
                <span>Öncelikli işler</span>
                <Link href="/isler" className="btn sm">Tümü</Link>
              </h3>
              {priorityJobs.length === 0 ? (
                <div className="mini">Yüksek öncelikli açık iş yok.</div>
              ) : (
                priorityJobs.map((j) => <JobLine key={j.id} j={j} />)
              )}
            </div>

            <div className="card">
              <h3>Yaklaşan teslimler</h3>
              {upcomingDue.length === 0 ? (
                <div className="mini">Son tarihi olan açık iş yok.</div>
              ) : (
                upcomingDue.map((j) => <JobLine key={j.id} j={j} />)
              )}
            </div>
          </div>

          <div>
            <QuickTask users={users} />

            {user.role === "MUDUR" && (
              <div className="card">
                <h3>Kişiye göre (ekip)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {perPerson.map((p) => (
                    <div key={p.name}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                      <div className="mini" style={{ display: "flex", gap: 10, marginTop: 1 }}>
                        <span><b style={{ color: "var(--brand)" }}>{p.open}</b> açık</span>
                        <span><b>{p.done}</b> bitti</span>
                        <span><b>{p.support}</b> destek</span>
                      </div>
                    </div>
                  ))}
                  {unassigned > 0 && <div className="mini">Atanmamış: <b>{unassigned}</b></div>}
                </div>
              </div>
            )}

            <div className="card">
              <h3>Yaklaşan etkinlikler</h3>
              {upcomingEvents.length === 0 ? (
                <div className="mini">Yaklaşan etkinlik yok.</div>
              ) : (
                upcomingEvents.map((e) => {
                  const soon = daysUntil(e.date) <= 7;
                  return (
                    <Link key={e.id} href={`/takvim/${e.id}`} className="item" style={{ display: "block" }}>
                      <div className="title" style={{ fontSize: 13.5 }}>{e.title}</div>
                      <div className="meta">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(soon ? { color: "var(--red)", fontWeight: 600 } : {}) }}>
                          <Icon name="calendar" size={13} /> {fmtDate(e.date)}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
