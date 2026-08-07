"use client";

import { STATUSES, PRIORITIES, VISIBILITIES } from "@/lib/constants";

export type UserOption = { id: string; name: string };

type Props = {
  action: (formData: FormData) => void;
  users: UserOption[];
  submitLabel: string;
  initial?: {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    visibility?: string;
    dueDate?: string; // YYYY-MM-DD
    assigneeId?: string | null;
    requesterId?: string | null;
    supportIds?: string[];
  };
};

export default function JobForm({ action, users, submitLabel, initial }: Props) {
  return (
    <form action={action} className="formgrid">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <label htmlFor="title">Başlık *</label>
        <input id="title" name="title" required defaultValue={initial?.title ?? ""} placeholder="Örn: X firması gümrük dosyası" />
      </div>

      <div>
        <label htmlFor="description">Açıklama</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ""} placeholder="İşin detayları…" />
      </div>

      <div className="row">
        <div style={{ minWidth: 140 }}>
          <label htmlFor="status">Durum</label>
          <select id="status" name="status" defaultValue={initial?.status ?? "BEKLEMEDE"}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label htmlFor="priority">Öncelik</label>
          <select id="priority" name="priority" defaultValue={initial?.priority ?? "ORTA"}>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="visibility">Görünürlük</label>
        <select id="visibility" name="visibility" defaultValue={initial?.visibility ?? "HERKES"}>
          {VISIBILITIES.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="row">
        <div style={{ minWidth: 140 }}>
          <label htmlFor="assigneeId">Sorumlu</label>
          <select id="assigneeId" name="assigneeId" defaultValue={initial?.assigneeId ?? ""}>
            <option value="">— Atanmadı —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label htmlFor="requesterId">Kimden istendi</label>
          <select id="requesterId" name="requesterId" defaultValue={initial?.requesterId ?? ""}>
            <option value="">— Belirtilmedi —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label>Takip-Destek (kişiler)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {users.map((u) => (
            <label key={u.id} className="chk">
              <input type="checkbox" name="supportIds" value={u.id} defaultChecked={initial?.supportIds?.includes(u.id)} />
              {u.name}
            </label>
          ))}
        </div>
      </div>

      <div className="row">
        <div style={{ minWidth: 140 }}>
          <label htmlFor="dueDate">Son tarih</label>
          <input id="dueDate" name="dueDate" type="date" defaultValue={initial?.dueDate ?? ""} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button className="btn primary" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
