// Şirket logosu — halka + altıgen boşluk, gri→mavi degrade (marka kimliğinden)
export default function Logo({ size = 34 }: { size?: number }) {
  const donut =
    "M60 4 A56 56 0 1 0 60 116 A56 56 0 1 0 60 4 Z " +
    "M43 30.6 L77 30.6 L94 60 L77 89.4 L43 89.4 L26 60 Z";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Logo" role="img">
      <defs>
        <linearGradient id="lg-gray" x1="18" y1="8" x2="58" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d7dadf" />
          <stop offset="1" stopColor="#31343a" />
        </linearGradient>
        <linearGradient id="lg-blue" x1="82" y1="10" x2="82" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#21407c" />
          <stop offset="1" stopColor="#4370b4" />
        </linearGradient>
        <clipPath id="lg-right">
          <polygon points="55,0 120,0 120,120 67,120" />
        </clipPath>
      </defs>
      <path fillRule="evenodd" clipRule="evenodd" fill="url(#lg-gray)" d={donut} />
      <g clipPath="url(#lg-right)">
        <path fillRule="evenodd" clipRule="evenodd" fill="url(#lg-blue)" d={donut} />
      </g>
    </svg>
  );
}
