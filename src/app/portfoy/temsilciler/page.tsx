import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { portfoyYetki } from "@/lib/portfoy";
import { listele } from "@/lib/portfoy-temsilci";
import Icon from "@/components/Icon";
import Kadro from "./Kadro";

export const dynamic = "force-dynamic";

/** Temsilci kadrosu: yeni gelen, ayrılan, adı/ekibi/unvanı değişen. */
export default async function TemsilcilerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (portfoyYetki(user) !== "duzenle_tumu") redirect("/portfoy");

  const satirlar = await listele();

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/portfoy" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portala dön
        </Link>
        <span className="pfp-title">Temsilci Kadrosu</span>
        <span className="pfp-ara" />
        <span className="pfp-user">{user.name}</span>
      </div>
      <div className="tk-govde">
        <Kadro satirlar={satirlar} />
      </div>
    </div>
  );
}
