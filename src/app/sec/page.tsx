import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/(app)/actions";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import { roleLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Giriş sonrası portal seçimi.
 * Sol: İş Takibi (mevcut uygulama) · Sağ: Portföy Puanlama (tam portal)
 */
export default async function SecPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="sec-wrap">
      <div className="sec-top">
        <div className="sec-brand">
          <Logo size={32} />
          <div>
            <h1>Norm Lojistik</h1>
            <span>Hangi portala gireceksin?</span>
          </div>
        </div>
        <div className="sec-user">
          <span>
            <b>{user.name}</b> · {roleLabel(user.role)}
          </span>
          <form action={logoutAction}>
            <button className="sidebtn" type="submit" title="Çıkış yap" aria-label="Çıkış yap">
              <Icon name="logout" size={16} />
            </button>
          </form>
        </div>
      </div>

      <div className="sec-grid">
        <Link href="/" className="sec-card sec-is">
          <div className="sec-ic"><Icon name="folder" size={30} /></div>
          <h2>İş Takip Portalı</h2>
          <p>
            İşler, takvim, yapılacaklar ve ekip takibi. Günlük iş akışının
            tutulduğu yer.
          </p>
          <span className="sec-go">Gir <Icon name="chevronRight" size={15} /></span>
        </Link>

        <Link href="/portfoy" className="sec-card sec-pf">
          <div className="sec-ic"><Icon name="chart" size={30} /></div>
          <h2>Portföy Puanlama Portalı</h2>
          <p>
            336 cari, temsilci iş yükü puanları, veri tamamlama ve portföy
            dağıtım tahtası.
          </p>
          <span className="sec-go">Gir <Icon name="chevronRight" size={15} /></span>
        </Link>
      </div>
    </div>
  );
}
