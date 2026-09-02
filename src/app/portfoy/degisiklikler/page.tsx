import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { degisiklikler } from "@/lib/portfoy";
import Icon from "@/components/Icon";
import Gecmis from "./Gecmis";

export const dynamic = "force-dynamic";

/** Kim, ne zaman, neyi değiştirdi. Herkes görebilir — şeffaflık için. */
export default async function DegisikliklerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const kayitlar = await degisiklikler(2000);

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/portfoy" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portala dön
        </Link>
        <span className="pfp-title">Değişiklik Geçmişi</span>
        <span className="pfp-ara" />
        <span className="pfp-user">{user.name}</span>
      </div>
      <div className="dg-govde">
        <Gecmis kayitlar={kayitlar} />
      </div>
    </div>
  );
}
