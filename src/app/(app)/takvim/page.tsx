import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, daysUntilLabel, daysUntil } from "@/lib/constants";
import Icon from "@/components/Icon";
import Calendar, { type CalEvent } from "./Calendar";
import NewEventButton from "./NewEventButton";

export default async function CalendarPage() {
  await requireUser();

  const events = await db.event.findMany({
    orderBy: { date: "asc" },
    include: { tasks: { select: { done: true } } },
  });

  const calEvents: CalEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date.toISOString(),
    taskDone: e.tasks.filter((t) => t.done).length,
    taskTotal: e.tasks.length,
  }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => e.date >= todayStart).slice(0, 8);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Takvim</h2>
          <div className="sub">Denetimler, teslim tarihleri ve etkinlikler</div>
        </div>
        <div className="spacer" />
        <NewEventButton />
      </div>

      <div className="content">
        <Calendar events={calEvents} />

        <div className="card">
          <h3>Yaklaşan Etkinlikler</h3>
          {upcoming.length === 0 ? (
            <div className="mini">Yaklaşan etkinlik yok.</div>
          ) : (
            upcoming.map((e) => {
              const done = e.tasks.filter((t) => t.done).length;
              const soon = daysUntil(e.date) <= 7;
              return (
                <Link key={e.id} href={`/takvim/${e.id}`} className="item" style={{ display: "block" }}>
                  <div className="top">
                    <div style={{ flex: 1 }}>
                      <div className="title">{e.title}</div>
                      <div className="meta">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(soon ? { color: "var(--red)", fontWeight: 600 } : {}) }}>
                          <Icon name="calendar" size={13} /> {fmtDate(e.date)} · {daysUntilLabel(e.date)}
                        </span>
                        {e.tasks.length > 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <Icon name="check" size={13} /> {done}/{e.tasks.length} görev
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
