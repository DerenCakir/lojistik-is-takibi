"use client";

import { useState } from "react";
import { setJobTaskTags } from "./actions";

type UserOption = { id: string; name: string };

type Props = {
  taskId: string;
  jobId: string;
  users: UserOption[];
  tags: { id: string; name: string }[];
};

export default function TaskTags({ taskId, jobId, users, tags }: Props) {
  const [editing, setEditing] = useState(false);

  async function action(formData: FormData) {
    await setJobTaskTags(formData);
    setEditing(false);
  }

  if (editing) {
    return (
      <form action={action} style={{ marginTop: 6 }}>
        <input type="hidden" name="id" value={taskId} />
        <input type="hidden" name="jobId" value={jobId} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {users.map((u) => (
            <label key={u.id} className="chk" style={{ fontSize: 12.5, padding: "5px 9px" }}>
              <input type="checkbox" name="tagIds" value={u.id} defaultChecked={tags.some((t) => t.id === u.id)} />
              {u.name}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="submit" className="btn sm primary">Kaydet</button>
          <button type="button" className="btn sm ghost" onClick={() => setEditing(false)}>İptal</button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {tags.map((t) => (
        <span key={t.id} className="tag" style={{ margin: 0, background: "var(--brand-soft)", color: "var(--brand)" }}>
          {t.name}
        </span>
      ))}
      <button type="button" className="btn sm ghost" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setEditing(true)}>
        {tags.length ? "kişileri düzenle" : "+ kişi etiketle"}
      </button>
    </div>
  );
}
