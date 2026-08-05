"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { STATUSES, statusInfo, priorityInfo, fmtDate, daysUntilLabel, daysUntil } from "@/lib/constants";

export type JobRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null; // ISO
  assigneeName: string | null;
  taskDone: number;
  taskTotal: number;
  updateCount: number;
};

export default function JobList({ jobs }: { jobs: JobRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("due");

  const filtered = useMemo(() => {
    let list = [...jobs];
    if (status !== "all") list = list.filter((j) => j.status === status);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (j) => j.title.toLowerCase().includes(s) || (j.assigneeName ?? "").toLowerCase().includes(s)
      );
    }
    const prioRank: Record<string, number> = { YUKSEK: 0, ORTA: 1, DUSUK: 2 };
    if (sort === "due") {
      list.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    } else if (sort === "priority") {
      list.sort((a, b) => (prioRank[a.priority] ?? 1) - (prioRank[b.priority] ?? 1));
    }
    return list;
  }, [jobs, q, status, sort]);

  return (
    <>
      <div className="toolbar">
        <input className="search" placeholder="İş veya sorumlu ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Tüm durumlar</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="due">Sırala: son tarih</option>
          <option value="priority">Sırala: öncelik</option>
        </select>
        <div className="spacer" />
        <span className="mini">{filtered.length} iş</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div>Kayıt bulunamadı.</div>
          <div className="mini">Yeni bir iş ekleyerek başlayın.</div>
        </div>
      ) : (
        filtered.map((j) => {
          const st = statusInfo(j.status);
          const pr = priorityInfo(j.priority);
          const overdue = j.dueDate && j.status !== "TAMAMLANDI" && daysUntil(j.dueDate) < 0;
          return (
            <Link key={j.id} href={`/isler/${j.id}`} className="item" style={{ display: "block" }}>
              <div className="top">
                <div style={{ flex: 1 }}>
                  <div className="title">{j.title}</div>
                  <div className="meta">
                    <span className={`status-pill ${st.cls}`}>{st.label}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span className="dot" style={{ background: pr.color }} /> {pr.label}
                    </span>
                    {j.assigneeName && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Icon name="user" size={13} /> {j.assigneeName}
                      </span>
                    )}
                    {j.dueDate && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...(overdue ? { color: "var(--red)", fontWeight: 600 } : {}) }}>
                        <Icon name="calendar" size={13} /> {fmtDate(j.dueDate)} · {daysUntilLabel(j.dueDate)}
                      </span>
                    )}
                    {j.taskTotal > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Icon name="check" size={13} /> {j.taskDone}/{j.taskTotal}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })
      )}
    </>
  );
}
