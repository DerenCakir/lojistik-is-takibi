import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { portfoyYetki, yazabilir } from "@/lib/portfoy";
import { kartListesi, temsilciler, turler } from "@/lib/portfoy-kart";
import Icon from "@/components/Icon";
import Kartlar from "./Kartlar";

export const dynamic = "force-dynamic";

/**
 * Müşteri Kartları — süreç notları ve yedek temsilciler.
 * Herkes okur; müdür ve yöneticiler yazar.
 * Rakamlar ana portalın view'lerinden canlı okunur, kopya tutulmaz.
 */
export default async function MusteriKartlariPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const yazar = yazabilir(portfoyYetki(user));

  const [liste, turListesi, temsilciListesi] = await Promise.all([
    kartListesi(), turler(), temsilciler(),
  ]);

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/portfoy" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portala dön
        </Link>
        <span className="pfp-title">Müşteri Kartları</span>
        <span className="pfp-ara" />
        <span className="pfp-user">{user.name}</span>
      </div>
      <Kartlar liste={liste} turler={turListesi} temsilciler={temsilciListesi} yazar={yazar} />
    </div>
  );
}
