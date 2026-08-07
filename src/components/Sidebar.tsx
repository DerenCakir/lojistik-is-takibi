"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/(app)/actions";
import ThemeButton from "./ThemeButton";
import Logo from "./Logo";
import Icon from "./Icon";

type Props = {
  user: CurrentUser;
  counts: { openJobs: number; upcomingEvents: number };
};

export default function Sidebar({ user, counts }: Props) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="side">
      <div className="brand">
        <Logo size={30} />
        <div>
          <h1>Lojistik İş Takibi</h1>
          <span>İş takip portalı</span>
        </div>
      </div>

      <nav className="sidenav">
        <div className="nav-label">Menü</div>
        <Link href="/" className={`navbtn ${isActive("/") ? "active" : ""}`}>
          <span className="ic"><Icon name="home" size={17} /></span> Panel
        </Link>
        <Link href="/isler" className={`navbtn ${isActive("/isler") ? "active" : ""}`}>
          <span className="ic"><Icon name="folder" size={17} /></span> İşler
          {counts.openJobs > 0 && <span className="badge">{counts.openJobs}</span>}
        </Link>
        <Link href="/takvim" className={`navbtn ${isActive("/takvim") ? "active" : ""}`}>
          <span className="ic"><Icon name="calendar" size={17} /></span> Takvim
          {counts.upcomingEvents > 0 && <span className="badge">{counts.upcomingEvents}</span>}
        </Link>
        <Link href="/kullanicilar" className={`navbtn ${isActive("/kullanicilar") ? "active" : ""}`}>
          <span className="ic"><Icon name="users" size={17} /></span> Kullanıcılar
        </Link>
      </nav>

      <div className="side-foot">
        <div className="userbar">
          <div className="avatar">{initials}</div>
          <div className="uinfo">
            <div className="nm">{user.name}</div>
            <div className="rl">{user.role === "MANAGER" ? "Yönetici" : "Çalışan"}</div>
          </div>
          <ThemeButton />
          <form action={logoutAction}>
            <button className="sidebtn" type="submit" title="Çıkış yap" aria-label="Çıkış yap">
              <Icon name="logout" size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
