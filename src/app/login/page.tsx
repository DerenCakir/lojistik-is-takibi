import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="login-wrap">
      <div className="login-bg" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lnStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4f46e5" />
              <stop offset="1" stopColor="#0ea5b7" />
            </linearGradient>
            <radialGradient id="blobA" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#4f46e5" stopOpacity="0.20" />
              <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="blobB" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#0ea5b7" stopOpacity="0.18" />
              <stop offset="1" stopColor="#0ea5b7" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* yumuşak ışık lekeleri */}
          <circle cx="1240" cy="130" r="360" fill="url(#blobA)" />
          <circle cx="180" cy="820" r="380" fill="url(#blobB)" />
          {/* modern akışkan çizgiler */}
          <g fill="none" stroke="url(#lnStroke)" strokeLinecap="round">
            <path d="M-120 250 C 320 90, 640 380, 1000 210 S 1560 120, 1640 300" strokeWidth="1.6" opacity="0.16" />
            <path d="M-120 330 C 320 170, 640 460, 1000 290 S 1560 200, 1640 380" strokeWidth="1.4" opacity="0.12" />
            <path d="M-120 410 C 320 250, 640 540, 1000 370 S 1560 280, 1640 460" strokeWidth="1.2" opacity="0.09" />
            <path d="M-200 640 C 300 520, 760 760, 1140 600 S 1600 560, 1680 700" strokeWidth="1.4" opacity="0.10" />
          </g>
        </svg>
      </div>
      <div className="login-card">
        <div className="lg-brand">
          <Logo size={46} />
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 750, letterSpacing: "-.02em" }}>Lojistik İş Takibi</h1>
            <span className="mini" style={{ marginTop: 2, display: "block" }}>Devam etmek için giriş yapın</span>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
