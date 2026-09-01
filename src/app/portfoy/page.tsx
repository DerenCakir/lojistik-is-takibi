import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { portfoyYetki, sonDegisiklik, yazabilir } from "@/lib/portfoy";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * Portföy Puanlama Portalı.
 *
 * Portalın kendisi `public/portfoy-portal.html` içinde tek dosya olarak durur —
 * yedi sekmesiyle birlikte, geliştirildiği hâliyle. Verisini bu uygulamanın
 * /api/portfoy/* uçlarından alır; oturum çerezi taşındığı için ikinci bir
 * giriş istemez. Veriler Supabase'deki `portfoy` şemasında kalır.
 */
export default async function PortfoyPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const yetki = portfoyYetki(user);
  const mudur = yetki === "duzenle_tumu";
  const yazar = yazabilir(yetki);
  const son = await sonDegisiklik();
  const z = (n: number) => String(n).padStart(2, "0");
  const sonMetin = son
    ? `son değişiklik: ${son.kullanici} · ${z(son.ts.getDate())}.${z(son.ts.getMonth() + 1)} ` +
      `${z(son.ts.getHours())}:${z(son.ts.getMinutes())}`
    : "henüz değişiklik yok";

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/sec" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portal seçimi
        </Link>
        <span className="pfp-title">Portföy Puanlama Portalı</span>
        <Link href="/portfoy/degisiklikler" className="pfp-son" title="Değişiklik geçmişi">
          <Icon name="clock" size={13} /> {sonMetin}
        </Link>
        <span className="pfp-ara" />
        {yazar && (
          <Link href="/portfoy/temsilciler" className="pfp-eylem">
            <Icon name="users" size={14} /> Temsilciler
          </Link>
        )}
        {mudur && (
          <Link href="/portfoy/veri-yukle" className="pfp-eylem">
            <Icon name="plus" size={14} /> Veri yükle
          </Link>
        )}
        <span className="pfp-user">{user.name}</span>
      </div>
      <iframe
        className="pfp-frame"
        src="/portfoy-portal.html"
        title="Portföy Puanlama Portalı"
      />
    </div>
  );
}
