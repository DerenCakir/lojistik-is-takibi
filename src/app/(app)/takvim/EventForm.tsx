"use client";

type Props = {
  action: (formData: FormData) => void;
  submitLabel: string;
  initial?: { id?: string; title?: string; description?: string; date?: string };
};

export default function EventForm({ action, submitLabel, initial }: Props) {
  return (
    <form action={action} className="formgrid">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label htmlFor="ev-title">Etkinlik adı *</label>
        <input id="ev-title" name="title" required defaultValue={initial?.title ?? ""} placeholder="Örn: Yıllık gümrük denetimi" />
      </div>
      <div>
        <label htmlFor="ev-date">Tarih *</label>
        <input id="ev-date" name="date" type="date" required defaultValue={initial?.date ?? ""} />
      </div>
      <div>
        <label htmlFor="ev-desc">Açıklama</label>
        <textarea id="ev-desc" name="description" defaultValue={initial?.description ?? ""} placeholder="Etkinlik hakkında detaylar…" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button className="btn primary" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
