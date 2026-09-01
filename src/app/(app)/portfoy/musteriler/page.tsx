import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { cariler, portfoyYetki, yazabilir, portfoyErisilebilir } from "@/lib/portfoy";
import PortfoyYok from "../PortfoyYok";
import CariTablo from "./CariTablo";
import type { CariSatir } from "./tipler";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const user = await requireUser();
  const yetki = portfoyYetki(user);
  if (!(await portfoyErisilebilir())) return <PortfoyYok />;
  const veri = await cariler();

  // Sunucudaki geniş satırı istemcinin ihtiyacı olan alanlara indiriyoruz.
  const satirlar: CariSatir[] = veri.map((c) => ({
    cari_kod: c.cari_kod,
    cari_ad: c.cari_ad,
    kanal: c.kanal,
    segment: c.segment,
    onem: c.onem,
    zorluk: c.zorluk,
    siparis_tipi: c.siparis_tipi,
    kim_oduyor: c.kim_oduyor,
    ekipman: c.ekipman,
    portal: c.portal,
    etiket: c.etiket,
    asn: c.asn,
    nl: c.nl,
    al: c.al,
    sv: c.sv,
    gm: c.gm,
    yuk: c.yuk,
    bos_hucre: c.bos_hucre,
    temsilciler: c.temsilciler,
  }));

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Portföy Müşterileri</h2>
          <div className="sub">
            Sınıflandırma alanları · yük katkıları veritabanında hesaplanır
          </div>
        </div>
        <div className="spacer" />
        <Link href="/portfoy" className="btn">Temsilci puanları</Link>
      </div>

      <div className="content">
        <CariTablo satirlar={satirlar} duzenlenebilir={yazabilir(yetki)} />
      </div>
    </>
  );
}
