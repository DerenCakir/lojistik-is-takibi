import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateLong, daysUntilLabel, daysUntil, toDateInput } from "@/lib/constants";
import Icon from "@/components/Icon";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import EditEventButton from "../EditEventButton";
import EventTaskItem from "../EventTaskItem";
import { deleteEvent, addEventTask } from "../actions";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const isManager = true; // herkes her şeyi yapabilir

  const [event, users] = await Promise.all([
    db.event.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        tasks: { orderBy: { order: "asc" }, include: { assignee: { select: { name: true } } } },
      },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!event) notFound();

  const done = event.tasks.filter((t) => t.done).length;
  const progress = event.tasks.length ? Math.round((done / event.tasks.length) * 100) : 0;
  const soon = daysUntil(event.date) >= 0 && daysUntil(event.date) <= 7;
  const past = daysUntil(event.date) < 0;

  return (
    <>
      <div className="topbar">
        <Link href="/takvim" className="btn sm ghost" style={{ gap: 5 }}><Icon name="arrowLeft" size={15} /> Takvim</Link>
        <div>
          <h2>{event.title}</h2>
          <div className="sub">Oluşturan: {event.createdBy.name}</div>
        </div>
        <div className="spacer" />
        {isManager && (
          <>
            <EditEventButton event={{ id: event.id, title: event.title, description: event.description, date: toDateInput(event.date) }} />
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={event.id} />
              <ConfirmSubmit className="btn sm danger" message="Bu etkinlik ve tüm görevleri silinsin mi?">Sil</ConfirmSubmit>
            </form>
          </>
        )}
      </div>

      <div className="content">
        <div className="card">
          <div className="meta" style={{ fontSize: 14, marginBottom: event.description ? 12 : 0 }}>
            <span
              className="status-pill"
              style={{
                background: past ? "var(--chip)" : soon ? "rgba(220,38,38,.16)" : "rgba(37,99,235,.16)",
                color: past ? "var(--muted)" : soon ? "var(--red)" : "var(--blue)",
              }}
            >
              <Icon name="calendar" size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> {fmtDateLong(event.date)}
            </span>
            <b style={soon ? { color: "var(--red)" } : undefined}>{daysUntilLabel(event.date)}</b>
          </div>
          {event.description && <div style={{ whiteSpace: "pre-wrap" }}>{event.description}</div>}
        </div>

        <div className="card">
          <h3>Yapılacaklar {event.tasks.length > 0 && <span className="mini">({done}/{event.tasks.length})</span>}</h3>
          {event.tasks.length > 0 && (
            <div className="progress" style={{ marginBottom: 14 }}>
              <div style={{ width: `${progress}%` }} />
            </div>
          )}

          {event.tasks.length === 0 ? (
            <div className="mini" style={{ marginBottom: isManager ? 14 : 0 }}>
              Henüz görev eklenmemiş.{isManager ? " Aşağıdan ekleyebilirsiniz." : " Yönetici görev ekleyince burada görünecek."}
            </div>
          ) : (
            event.tasks.map((t) => (
              <EventTaskItem
                key={t.id}
                eventId={event.id}
                isManager={isManager}
                task={{ id: t.id, text: t.text, note: t.note, done: t.done, assigneeName: t.assignee?.name ?? null }}
              />
            ))
          )}

          {isManager && (
            <>
              <div className="divider" />
              <form action={addEventTask} className="formgrid">
                <input type="hidden" name="eventId" value={event.id} />
                <div>
                  <label htmlFor="et-text">Yeni görev *</label>
                  <input id="et-text" name="text" required placeholder="Örn: Depo yangın tüplerini kontrol et" />
                </div>
                <div className="row">
                  <div style={{ minWidth: 160 }}>
                    <label htmlFor="et-assignee">Sorumlu (opsiyonel)</label>
                    <select id="et-assignee" name="assigneeId" defaultValue="">
                      <option value="">— Atanmadı —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="et-note">Açıklama / not (opsiyonel)</label>
                  <input id="et-note" name="note" placeholder="Ek bilgi…" />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn primary" type="submit">Görev Ekle</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
