import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { temsilciKimligi } from "@/lib/portfoy";
import { logoutAction } from "@/app/(app)/actions";
import { benimMusterilerim, yedegiOldugum, hatirlatmalarim } from "@/lib/portfoy-portfoyum";
import { db } from "@/lib/db";
import Icon from "@/components/Icon";
import Portfoyum from "./Portfoyum";

export const dynamic = "force-dynamic";

/**
 * Portföyüm — temsilcinin kendi sayfası.
 * Yalnız temsilci hesabına bağlı kullanıcılar girer; yöneticiler Müşteri
 * Kartları'nı kullanır. Bu sayfa hiçbir puan/yük/sevkiyat okumaz.
 */
export default async function PortfoyumPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = await temsilciKimligi(user);
  if (!id) redirect("/portfoy");                                   // yönetici: kendi portalına

  const [[t], benim, yedek, hat, temsilciler] = await Promise.all([
    db.$queryRaw<{ ad: string; ekip: string | null }[]>`select ad, ekip from portfoy.temsilci where id = ${id}`,
    benimMusterilerim(id), yedegiOldugum(id), hatirlatmalarim(id),
    db.$queryRaw<{ id: bigint; ad: string; ekip: string | null }[]>`
      select id, ad, ekip from portfoy.temsilci where aktif and id <> ${id} order by ad`,
  ]);

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/sec" className="pfp-back"><Icon name="arrowLeft" size={15} /> Portal seçimi</Link>
        <span className="pfp-title">Portföyüm</span>
        <span className="pfp-ara" />
        <span className="pfp-user">{t?.ad ?? user.name}{t?.ekip ? ` · ${t.ekip === "YD" ? "Yurtdışı" : "Yurtiçi"}` : ""}</span>
        <form action={logoutAction}><button className="pfp-eylem" type="submit">Çıkış</button></form>
      </div>
      <Portfoyum benimId={id} ilkBenim={benim} ilkYedek={yedek} ilkHat={hat}
                 temsilciler={temsilciler.map((x) => ({ id: Number(x.id), ad: x.ad, ekip: x.ekip }))} />
    </div>
  );
}
