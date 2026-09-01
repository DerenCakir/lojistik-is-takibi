import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/sec" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portal seçimi
        </Link>
        <span className="pfp-title">Portföy Puanlama Portalı</span>
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
