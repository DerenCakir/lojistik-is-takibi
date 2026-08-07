"use client";

import { useRef } from "react";
import { createQuickTask } from "./isler/actions";
import { PRIORITIES } from "@/lib/constants";

type UserOption = { id: string; name: string };

export default function QuickTask({ users }: { users: UserOption[] }) {
  const ref = useRef<HTMLFormElement>(null);

  async function action(formData: FormData) {
    await createQuickTask(formData);
    ref.current?.reset();
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Hızlı Görev</h3>
      <form ref={ref} action={action} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div>
          <label htmlFor="qt-title">Ne yapılacak? *</label>
          <input id="qt-title" name="title" required placeholder="Kısa başlık" />
        </div>
        <div>
          <label htmlFor="qt-desc">Açıklama</label>
          <textarea id="qt-desc" name="description" placeholder="İstenen şeyler (opsiyonel)…" style={{ minHeight: 52 }} />
        </div>
        <div>
          <label htmlFor="qt-priority">Öncelik</label>
          <select id="qt-priority" name="priority" defaultValue="ORTA">
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qt-due">Teslim tarihi</label>
          <input id="qt-due" name="dueDate" type="date" />
        </div>
        <div>
          <label htmlFor="qt-assignee">Sorumlu</label>
          <select id="qt-assignee" name="assigneeId" defaultValue="">
            <option value="">— Bana —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qt-requester">Kimden istendi</label>
          <select id="qt-requester" name="requesterId" defaultValue="">
            <option value="">— Belirtilmedi —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Takip-Destek</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {users.map((u) => (
              <label key={u.id} className="chk" style={{ fontSize: 12.5, padding: "5px 9px" }}>
                <input type="checkbox" name="supportIds" value={u.id} />
                {u.name}
              </label>
            ))}
          </div>
        </div>
        <button className="btn primary" type="submit" style={{ justifyContent: "center" }}>Görev Ekle</button>
      </form>
    </div>
  );
}
