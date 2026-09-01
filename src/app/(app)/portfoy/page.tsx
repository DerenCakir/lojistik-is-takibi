import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { temsilciPuanlari, ozet, portfoyYetki, portfoyErisilebilir } from "@/lib/portfoy";
import PortfoyYok from "./PortfoyYok";

export const dynamic = "force-dynamic";

const UNVANLAR: Record<number, string> = {
  1: "Lojistik Sorumlusu",
  2: "Lojistik Uzmanı",
  3: "Lojistik Kıdemli Uzmanı",
};

const nf = (n: number, basamak = 1) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak });
const ni = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default async function PortfoyPage() {
  const user = await requireUser();
  const yetki = portfoyYetki(user);
  if (!(await portfoyErisilebilir())) return <PortfoyYok />;
  const [liste, o] = await Promise.all([temsilciPuanlari(), ozet()]);

  const enYuksek = Math.max(...liste.map((t) => t.puan), 1);
  const tamamlanma = o.cari === 0 ? 0 : Math.round(((o.cari * 10 - o.bos_hucre) / (o.cari * 10)) * 100);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Portföy İş Yükü</h2>
          <div className="sub">Temsilci puanları ve portföy dengesi</div>
        </div>
        <div className="spacer" />
        <Link href="/portfoy/musteriler" className="btn">Müşteriler</Link>
      </div>

      <div className="content">
        <div className="stats">
          <div className="stat">
            <div className="k">Cari</div>
            <div className="v">{ni(o.cari)}</div>
            <div className="m">{ni(o.teslim_noktasi)} teslim noktası</div>
          </div>
          <div className="stat">
            <div className="k">Sevkiyat</div>
            <div className="v">{ni(o.sevkiyat)}</div>
            <div className="m">{ni(o.malzeme_kodu)} malzeme kodu</div>
          </div>
          <div className="stat">
            <div className="k">Tamamlanma</div>
            <div className="v">%{tamamlanma}</div>
            <div className="m">{ni(o.bos_hucre)} boş hücre · {ni(o.eksiksiz)} eksiksiz cari</div>
          </div>
          <div className="stat">
            <div className="k">Temsilcisiz</div>
            <div className="v">{ni(o.temsilcisiz)}</div>
            <div className="m">dağıtılmayı bekliyor</div>
          </div>
        </div>

        <div className="card pf-card">
          <div className="pf-head">
            <h3>Temsilci sıralaması</h3>
            <span className="sub">
              Puan = (yük toplamı)<sup>0,25</sup> × 33 + gönüllü ek işler — veritabanında hesaplanır
            </span>
          </div>

          <div className="pf-scroll">
            <table className="pf-table">
              <thead>
                <tr>
                  <th className="w-rank">#</th>
                  <th>Temsilci</th>
                  <th>Ekip</th>
                  <th>Unvan</th>
                  <th className="num">Cari</th>
                  <th className="num">Sevkiyat</th>
                  <th className="num">Yük</th>
                  <th className="num">Ek iş</th>
                  <th className="num">Puan</th>
                  <th className="w-bar" />
                </tr>
              </thead>
              <tbody>
                {liste.map((t, i) => (
                  <tr key={t.temsilci} className={t.temsilci === "(atanmamış)" ? "pf-dim" : ""}>
                    <td className="w-rank">{i + 1}</td>
                    <td className="pf-name">{t.temsilci}</td>
                    <td>
                      {t.ekip === "YD" ? "Yurtdışı" : t.ekip === "YI" ? "Yurtiçi" : "—"}
                    </td>
                    <td className="pf-muted">{t.unvan ? UNVANLAR[t.unvan] : "—"}</td>
                    <td className="num">{nf(t.cari_sayisi, t.cari_sayisi % 1 ? 1 : 0)}</td>
                    <td className="num">{ni(t.sevkiyat)}</td>
                    <td className="num">{nf(t.yuk_toplam, 2)}</td>
                    <td className="num">{t.gonullu_puan ? `+${nf(t.gonullu_puan)}` : "—"}</td>
                    <td className="num pf-strong">{nf(t.puan)}</td>
                    <td className="w-bar">
                      <span className="pf-bar">
                        <b style={{ width: `${(t.puan / enYuksek) * 100}%` }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {yetki === "oku" && (
          <div className="pf-note">
            Görüntüleme yetkisiyle bakıyorsun. Sınıflandırma alanlarını değiştirmek için
            yönetici yetkisi gerekiyor.
          </div>
        )}
      </div>
    </>
  );
}
