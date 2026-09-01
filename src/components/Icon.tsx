import type { CSSProperties, ReactNode } from "react";

// Sade, tek renkli çizgi ikonlar (currentColor ile renk alır)
const ICONS: Record<string, ReactNode> = {
  home: (<><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /></>),
  folder: (<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />),
  calendar: (<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></>),
  users: (<><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.2" /><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" /><path d="M15.2 5a3.2 3.2 0 0 1 0 6" /></>),
  logout: (<><path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" /><path d="M15 16l4-4-4-4" /><path d="M19 12H9" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
  trash: (<><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /></>),
  edit: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>),
  check: (<path d="M20 6 9 17l-5-5" />),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  user: (<><path d="M18 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 6 18.5V20" /><circle cx="12" cy="8" r="3.4" /></>),
  arrowLeft: (<><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>),
  chevronLeft: (<path d="M15 18l-6-6 6-6" />),
  chevronRight: (<path d="M9 18l6-6-6-6" />),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: (<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />),
  chart: (<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
};

type Props = { name: string; size?: number; style?: CSSProperties; strokeWidth?: number };

export default function Icon({ name, size = 18, style, strokeWidth = 1.8 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {ICONS[name] ?? null}
    </svg>
  );
}
