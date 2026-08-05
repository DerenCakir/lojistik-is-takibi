import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Icon from "@/components/Icon";
import { statusInfo, priorityInfo, fmtDate, fmtDateLong, daysUntilLabel, daysUntil } from "@/lib/constants";

export default async function DashboardPage() {
  const user = await requireUser();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [openCount, doingCount, doneCount, overdueCount, activeJobs, upcomingEvents, users] = await Promise.all([
    db.job.count({ where: { status: "BEKLEMEDE" } }),
    db.job.count({ where: { status: "DEVAM" } }),
    db.job.count({ where: { status: "TAMAMLANDI" } }),
    db.job.count({ where: { status: { not: "TAMAMLANDI" }, dueDate: { lt: todayStart } } }),
    db.job.findMany({
      where: { status: { not: "TAMAMLANDI" } },
      include: { assignee: { select: { id: true, name: true } } },
    }),
    db.event.findMany({
      where: { date: { gte: todayStart } },
      orderBy: { date: "asc" },
      take: 5,
      include: { tasks: { select: { done: true } } },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const sortedActive = [...activeJobs].sort((a, b) => {
    const ad = a.dueDate ? a.dueDate.getTime() : Infinity;
    const bd = b.dueDate ? b.dueDate.getTime() : Infinity;
    return ad - bd;
  });

  const perPerson = users
    .map((u) => ({ name: u.name, count: activeJobs.filter((j) => j.assigneeId === u.id).length }))
    .sort((a, b) => b.count - a.count);
  const unassigned = activeJobs.filter((j) => !j.assigneeId).length;

  const shown = sortedActive.slice(0, 10);

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

        <div className="card">
          <h3 style={{ justifyContent: "space-between" }}>
            <span>Takip edilen işler</span>
            <Link href="/isler" className="btn sm">Tümü</Link>
          </h3>

          {shown.length === 0 ? (
            <div className="empty">
              <div>Aktif iş yok.</div>
              <div className="mini"><Link href="/isler" style={{ color: "var(--brand)" }}>İşler</Link> bölümünden yeni iş ekleyin.</div>
            </div>
          ) : (
            shown.map((j) => {
              const st = statusInfo(j.status);
              const pr = priorityInfo(j.priority);
              const overdue = j.dueDate && daysUntil(j.dueDate) < 0;
              return (
                <Link key={j.id} href={`/isler/${j.id}`} className="item" style={{ display: "block" }}>
                  <div className="title">{j.title}</div>
                  <div className="meta">
                    <span className={`status-pill ${st.cls}`}>{st.label}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span className="dot" style={{ background: pr.color }} /> {pr.label}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon name="user" size={13} /> {j.assignee?.name ?? "Atanmadı"}
                    </span>
                    {j.dueDate && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(overdue ? { color: "var(--red)", fontWeight: 600 } : {}) }}>
                        <Icon name="calendar" size={13} /> {fmtDate(j.dueDate)} · {daysUntilLabel(j.dueDate)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
          {sortedActive.length > shown.length && (
            <div className="mini" style={{ marginTop: 8 }}>
              +{sortedActive.length - shown.length} iş daha · <Link href="/isler" style={{ color: "var(--brand)" }}>hepsini gör</Link>
            </div>
          )}
        </div>

        <div className="grid g2">
          <div className="card">
            <h3>Kişiye göre açık işler</h3>
            {perPerson.length === 0 ? (
              <div className="mini">Henüz kullanıcı yok.</div>
            ) : (
              <>
                {perPerson.map((p) => (
                  <div key={p.name} className="checkline" style={{ justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                        {p.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      {p.name}
                    </span>
                    <span className="chip" style={{ fontWeight: 600, color: "var(--brand)" }}>{p.count} iş</span>
                  </div>
                ))}
                {unassigned > 0 && (
                  <div className="checkline" style={{ justifyContent: "space-between" }}>
                    <span className="mini">Atanmamış</span>
                    <span className="chip">{unassigned} iş</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h3>Yaklaşan etkinlikler</h3>
            {upcomingEvents.length === 0 ? (
              <div className="mini">Yaklaşan etkinlik yok.</div>
            ) : (
              upcomingEvents.map((e) => {
                const done = e.tasks.filter((t) => t.done).length;
                const soon = daysUntil(e.date) <= 7;
                return (
                  <Link key={e.id} href={`/takvim/${e.id}`} className="item" style={{ display: "block" }}>
                    <div className="title" style={{ fontSize: 14 }}>{e.title}</div>
                    <div className="meta">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(soon ? { color: "var(--red)", fontWeight: 600 } : {}) }}>
                        <Icon name="calendar" size={13} /> {fmtDate(e.date)} · {daysUntilLabel(e.date)}
                      </span>
                      {e.tasks.length > 0 && <span>{done}/{e.tasks.length} görev</span>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
