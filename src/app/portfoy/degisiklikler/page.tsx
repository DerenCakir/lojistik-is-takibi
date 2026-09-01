import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { degisiklikler } from "@/lib/portfoy";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/** Kim, ne zaman, neyi değiştirdi. Herkes görebilir — şeffaflık için. */
export default async function DegisikliklerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const kayitlar = await degisiklikler(300);

  const tarih = (s: string) => {
    const d = new Date(s);
    const z = (n: number) => String(n).padStart(2, "0");
    return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
  };

  const BASLIK: Record<string, string> = {
    cari: "Müşteri sınıflandırma",
    cari_zorunlu: "Zorunlu ek iş",
    portfoy: "Temsilci ataması",
    "(tam kayit)": "Portal kaydı",
    "(veri yukleme)": "Excel veri yükleme",
  };

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
        {kayitlar.length === 0 ? (
          <div className="empty">Henüz kayıt yok.</div>
        ) : (
          <table className="pf-table dg-tablo">
            <thead>
              <tr>
                <th>Tarih · saat</th>
                <th>Kim</th>
                <th>Ne</th>
                <th>Kayıt</th>
                <th>Değişiklik</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id}>
                  <td className="dg-ts">{tarih(k.ts)}</td>
                  <td className="pf-name">{k.kullanici ?? "—"}</td>
                  <td>{BASLIK[k.tablo] ?? k.tablo}</td>
                  <td className="pf-muted">{k.kayit_id === "-" ? "" : k.kayit_id}</td>
                  <td>
                    {k.alan && <span className="dg-alan">{k.alan}</span>}
                    {k.eski && <span className="dg-eski">{k.eski}</span>}
                    {k.eski && k.yeni && <span className="dg-ok">→</span>}
                    {k.yeni && <span className="dg-yeni">{k.yeni}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="dg-not">Son 300 kayıt gösteriliyor, en yeni üstte.</div>
      </div>
    </div>
  );
}
