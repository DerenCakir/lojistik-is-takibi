// Uygulama geneli yumuşak dekoratif arka plan (giriş ekranıyla aynı dil)
export default function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="abStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#0ea5b7" />
          </linearGradient>
          <radialGradient id="abBlobA" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#4f46e5" stopOpacity="0.14" />
            <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="abBlobB" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#0ea5b7" stopOpacity="0.12" />
            <stop offset="1" stopColor="#0ea5b7" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="1300" cy="60" r="420" fill="url(#abBlobA)" />
        <circle cx="120" cy="880" r="420" fill="url(#abBlobB)" />
        <g fill="none" stroke="url(#abStroke)" strokeLinecap="round">
          <path d="M-160 210 C 320 60, 660 360, 1020 190 S 1600 100, 1700 300" strokeWidth="1.5" opacity="0.08" />
          <path d="M-160 300 C 320 150, 660 450, 1020 280 S 1600 190, 1700 390" strokeWidth="1.3" opacity="0.06" />
          <path d="M-220 660 C 320 540, 780 780, 1160 620 S 1620 580, 1720 720" strokeWidth="1.3" opacity="0.05" />
        </g>
      </svg>
    </div>
  );
}
