"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { toggleEventTask, updateEventTaskNote, deleteEventTask } from "./actions";

type Props = {
  task: { id: string; text: string; note: string; done: boolean; assigneeName: string | null };
  eventId: string;
  isManager: boolean;
};

export default function EventTaskItem({ task, eventId, isManager }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="item">
      <div className="top">
        <form action={toggleEventTask}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="eventId" value={eventId} />
          <button
            type="submit"
            title="Tamamlandı olarak işaretle"
            style={{
              width: 20, height: 20, borderRadius: 6, padding: 0, cursor: "pointer", marginTop: 2,
              border: `1.5px solid ${task.done ? "var(--brand)" : "var(--line)"}`,
              background: task.done ? "var(--brand)" : "transparent",
              color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {task.done && <Icon name="check" size={12} strokeWidth={2.6} />}
          </button>
        </form>

        <div style={{ flex: 1 }}>
          <div className={task.done ? "done-line title" : "title"} style={{ fontSize: 14 }}>{task.text}</div>
          {task.assigneeName && (
            <div className="meta">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="user" size={13} /> {task.assigneeName}
              </span>
            </div>
          )}

          {!editing && task.note && (
            <div className="body" style={{ background: "var(--panel)", borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
              {task.note}
            </div>
          )}

          {editing ? (
            <form action={updateEventTaskNote} style={{ marginTop: 8 }} onSubmit={() => setEditing(false)}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <textarea name="note" defaultValue={task.note} placeholder="Yaptığın geliştirmeyi / notu yaz…" />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                <button type="button" className="btn sm ghost" onClick={() => setEditing(false)}>İptal</button>
                <button type="submit" className="btn sm primary">Kaydet</button>
              </div>
            </form>
          ) : (
            <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setEditing(true)}>
              {task.note ? "Notu düzenle" : "+ Not / geliştirme ekle"}
            </button>
          )}
        </div>

        {isManager && (
          <form action={deleteEventTask}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="eventId" value={eventId} />
            <button type="submit" className="iconbtn" title="Sil"><Icon name="trash" size={15} /></button>
          </form>
        )}
      </div>
    </div>
  );
}
