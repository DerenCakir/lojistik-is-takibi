// Durum ve öncelik etiketleri + renkleri (tek yerden yönetilir)

export const STATUSES = [
  { id: "BEKLEMEDE", label: "Beklemede", cls: "st-open" },
  { id: "DEVAM", label: "Devam Ediyor", cls: "st-doing" },
  { id: "TAMAMLANDI", label: "Tamamlandı", cls: "st-done" },
] as const;

export const PRIORITIES = [
  { id: "DUSUK", label: "Düşük", color: "var(--muted)" },
  { id: "ORTA", label: "Orta", color: "var(--amber)" },
  { id: "YUKSEK", label: "Yüksek", color: "var(--red)" },
] as const;

export function statusInfo(id: string) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}
export function priorityInfo(id: string) {
  return PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1];
}

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${fmtDate(date)} ${h}:${m}`;
}

// input[type=date] için YYYY-MM-DD
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Kalan gün (bugünden hedefe). Negatif = geçmiş.
export function daysUntil(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysUntilLabel(d: Date | string): string {
  const n = daysUntil(d);
  if (n === 0) return "Bugün";
  if (n === 1) return "Yarın";
  if (n === -1) return "Dün";
  if (n > 0) return `${n} gün kaldı`;
  return `${Math.abs(n)} gün geçti`;
}

export { MONTHS_LONG, DAYS };
