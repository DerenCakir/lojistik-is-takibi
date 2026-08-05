"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { MONTHS_LONG, daysUntil } from "@/lib/constants";

export type CalEvent = { id: string; title: string; date: string; taskDone: number; taskTotal: number };

const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function Calendar({ events }: { events: CalEvent[] }) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  // Ay içindeki günleri hesapla (Pazartesi başlangıçlı)
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Pazartesi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { day: number; out: boolean; date: Date }[] = [];
  for (let i = 0; i < startOffset; i++) {
    const day = daysInPrev - startOffset + i + 1;
    cells.push({ day, out: true, date: new Date(year, month - 1, day) });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, out: false, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) {
    const day = cells.length - (startOffset + daysInMonth) + 1;
    cells.push({ day, out: true, date: new Date(year, month + 1, day) });
  }

  const eventsOn = (date: Date) =>
    events.filter((e) => {
      const ed = new Date(e.date);
      return ed.getFullYear() === date.getFullYear() && ed.getMonth() === date.getMonth() && ed.getDate() === date.getDate();
    });

  const isToday = (date: Date) =>
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, flex: 1 }}>{MONTHS_LONG[month]} {year}</h3>
        <button className="btn sm" onClick={prev} title="Önceki ay" style={{ padding: "6px 8px" }}><Icon name="chevronLeft" size={16} /></button>
        <button className="btn sm" onClick={goToday}>Bugün</button>
        <button className="btn sm" onClick={next} title="Sonraki ay" style={{ padding: "6px 8px" }}><Icon name="chevronRight" size={16} /></button>
      </div>

      <div className="cal">
        {DOW.map((d) => (
          <div key={d} className="dow">{d}</div>
        ))}
        {cells.map((c, i) => {
          const evs = eventsOn(c.date);
          return (
            <div key={i} className={`cell ${c.out ? "out" : ""} ${isToday(c.date) ? "today" : ""}`}>
              <div className="dnum">{c.day}</div>
              {evs.map((e) => {
                const soon = !c.out && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7;
                return (
                  <span
                    key={e.id}
                    className={`ev ${soon ? "soon" : ""}`}
                    title={e.title}
                    onClick={() => router.push(`/takvim/${e.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    {e.title}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
