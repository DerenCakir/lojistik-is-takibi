import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSeeJob } from "@/lib/jobs";
import { statusInfo, priorityInfo, STATUSES, fmtDate, fmtDateTime, daysUntilLabel, daysUntil, toDateInput } from "@/lib/constants";
import Icon from "@/components/Icon";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import EditJobButton from "../EditJobButton";
import TaskTags from "../TaskTags";
import {
  setJobStatus,
  deleteJob,
  addJobUpdate,
  deleteJobUpdate,
  addJobTask,
  toggleJobTask,
  deleteJobTask,
} from "../actions";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [job, users] = await Promise.all([
    db.job.findUnique({
      where: { id },
      include: {
        assignee: { select: { name: true } },
        requester: { select: { name: true } },
        support: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        tasks: { orderBy: { order: "asc" }, include: { tags: { select: { id: true, name: true } } } },
        updates: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!job) notFound();
  if (!canSeeJob(user, job)) notFound();

  const st = statusInfo(job.status);
  const pr = priorityInfo(job.priority);
  const overdue = job.dueDate && job.status !== "TAMAMLANDI" && daysUntil(job.dueDate) < 0;
  const doneTasks = job.tasks.filter((t) => t.done).length;
  const progress = job.tasks.length ? Math.round((doneTasks / job.tasks.length) * 100) : 0;

  return (
    <>
      <div className="topbar">
        <Link href="/isler" className="btn sm ghost" style={{ gap: 5 }}><Icon name="arrowLeft" size={15} /> İşler</Link>
        <div>
          <h2>{job.title}</h2>
          <div className="sub">Oluşturan: {job.createdBy.name} · {fmtDate(job.createdAt)}</div>
        </div>
        <div className="spacer" />
        <EditJobButton
          users={users}
          job={{
            id: job.id,
            title: job.title,
            description: job.description,
            status: job.status,
            priority: job.priority,
            visibility: job.visibility,
            dueDate: toDateInput(job.dueDate),
            assigneeId: job.assigneeId,
            requesterId: job.requesterId,
            supportIds: job.support.map((s) => s.id),
          }}
        />
        <form action={deleteJob}>
          <input type="hidden" name="id" value={job.id} />
          <ConfirmSubmit className="btn sm danger" message="Bu iş ve tüm notları silinsin mi?">Sil</ConfirmSubmit>
        </form>
      </div>

      <div className="content">
        {/* Üst bilgi kartı */}
        <div className="card">
          <div className="meta" style={{ marginBottom: job.description ? 12 : 0, fontSize: 13 }}>
            <span className={`status-pill ${st.cls}`}>{st.label}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span className="dot" style={{ background: pr.color }} /> {pr.label} öncelik
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Icon name="user" size={14} /> Sorumlu: <b style={{ color: "var(--txt)" }}>{job.assignee?.name ?? "Atanmadı"}</b>
            </span>
            {job.dueDate && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(overdue ? { color: "var(--red)", fontWeight: 600 } : {}) }}>
                <Icon name="calendar" size={14} /> {fmtDate(job.dueDate)} · {daysUntilLabel(job.dueDate)}
              </span>
            )}
          </div>
          {job.description && <div style={{ whiteSpace: "pre-wrap" }}>{job.description}</div>}

          {/* Hızlı durum değiştir */}
          <div className="divider" />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="mini">Durumu değiştir:</span>
            {STATUSES.map((s) => (
              <form key={s.id} action={setJobStatus}>
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="status" value={s.id} />
                <button className={`btn sm ${job.status === s.id ? "primary" : ""}`} type="submit">{s.label}</button>
              </form>
            ))}
          </div>
        </div>

        <div className="grid g2">
          {/* Checklist */}
          <div className="card">
            <h3>Yapılacaklar {job.tasks.length > 0 && <span className="mini">({doneTasks}/{job.tasks.length})</span>}</h3>
            {job.tasks.length > 0 && (
              <div className="progress" style={{ marginBottom: 12 }}>
                <div style={{ width: `${progress}%` }} />
              </div>
            )}
            {job.tasks.map((t) => (
              <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <form action={toggleJobTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      type="submit"
                      title="Tamamlandı olarak işaretle"
                      style={{
                        width: 20, height: 20, borderRadius: 6, padding: 0, cursor: "pointer",
                        border: `1.5px solid ${t.done ? "var(--brand)" : "var(--line)"}`,
                        background: t.done ? "var(--brand)" : "transparent",
                        color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {t.done && <Icon name="check" size={12} strokeWidth={2.6} />}
                    </button>
                  </form>
                  <span className={t.done ? "done-line" : ""} style={{ flex: 1 }}>{t.text}</span>
                  <form action={deleteJobTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <button type="submit" className="iconbtn" title="Sil"><Icon name="trash" size={15} /></button>
                  </form>
                </div>
                <div style={{ paddingLeft: 30 }}>
                  <TaskTags taskId={t.id} jobId={job.id} users={users} tags={t.tags} />
                </div>
              </div>
            ))}
            <form action={addJobTask} style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input type="hidden" name="jobId" value={job.id} />
              <input name="text" placeholder="Yeni madde ekle…" required />
              <button className="btn" type="submit">Ekle</button>
            </form>
          </div>

          {/* Bilgi kutusu */}
          <div className="card">
            <h3>Bilgiler</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              <div><span className="mini">Durum</span><br /><span className={`status-pill ${st.cls}`}>{st.label}</span></div>
              <div><span className="mini">Sorumlu</span><br /><b>{job.assignee?.name ?? "Atanmadı"}</b></div>
              <div><span className="mini">Kimden istendi</span><br />{job.requester?.name ?? "—"}</div>
              <div><span className="mini">Takip-Destek</span><br />{job.support.length ? job.support.map((s) => s.name).join(", ") : "—"}</div>
              <div><span className="mini">Son tarih</span><br />{job.dueDate ? `${fmtDate(job.dueDate)} · ${daysUntilLabel(job.dueDate)}` : "—"}</div>
              <div><span className="mini">Oluşturan</span><br />{job.createdBy.name}</div>
            </div>
          </div>
        </div>

        {/* Gelişme / not akışı */}
        <div className="card">
          <h3>Gelişmeler & Notlar</h3>
          <form action={addJobUpdate} style={{ marginBottom: 16 }}>
            <input type="hidden" name="jobId" value={job.id} />
            <textarea name="body" placeholder="Bir gelişme veya not yaz… (ör. 'Evrak tamamlandı, gümrüğe iletildi')" required />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn primary" type="submit">Ekle</button>
            </div>
          </form>

          {job.updates.length === 0 ? (
            <div className="mini">Henüz not eklenmemiş. İlk gelişmeyi yukarıdan ekleyebilirsin.</div>
          ) : (
            job.updates.map((u) => (
              <div key={u.id} className="item">
                <div className="top">
                  <div style={{ flex: 1 }}>
                    <div className="meta" style={{ marginTop: 0 }}>
                      <b style={{ color: "var(--txt)" }}>{u.author.name}</b>
                      <span>{fmtDateTime(u.createdAt)}</span>
                    </div>
                    <div className="body">{u.body}</div>
                  </div>
                  {u.authorId === user.id && (
                    <form action={deleteJobUpdate}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="jobId" value={job.id} />
                      <button type="submit" className="iconbtn" title="Sil"><Icon name="trash" size={15} /></button>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
