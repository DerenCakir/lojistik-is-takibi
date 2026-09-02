"use client";

import { useMemo, useState } from "react";
import type { Degisiklik } from "@/lib/portfoy";

/** Kişi ve gün filtresiyle, güne göre gruplanmış değişiklik geçmişi. */

const BASLIK: Record<string, string> = {
  cari: "Sınıflandırma",
  cari_zorunlu: "Zorunlu ek iş",
  portfoy: "Temsilci ataması",
  temsilci: "Temsilci kadrosu",
  "(tam kayit)": "Kaydetme",
  "(veri yukleme)": "Excel veri yükleme",
};

const z = (n: number) => String(n).padStart(2, "0");
const gunKey = (s: string) => {
  const d = new Date(s);
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
               "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const gunAd = (k: string) => {
  const [y, a, g] = k.split("-").map(Number);
  return `${g} ${AYLAR[a - 1]} ${y}`;
};
const saat = (s: string) => {
  const d = new Date(s);
  return `${z(d.getHours())}:${z(d.getMinutes())}`;
};

export default function Gecmis({ kayitlar }: { kayitlar: Degisiklik[] }) {
  const [kisi, setKisi] = useState("");
  const [gun, setGun] = useState("");
  const [tur, setTur] = useState("");
  const [ozetGoster, setOzetGoster] = useState(false);

  const kisiler = useMemo(
    () => [...new Set(kayitlar.map((k) => k.kullanici).filter(Boolean))].sort() as string[],
    [kayitlar]);
  const gunler = useMemo(
    () => [...new Set(kayitlar.map((k) => gunKey(k.ts)))], [kayitlar]);
  const turler = useMemo(
    () => [...new Set(kayitlar.map((k) => k.tablo))], [kayitlar]);

  const gorunen = useMemo(() => kayitlar.filter((k) => {
    if (kisi && k.kullanici !== kisi) return false;
    if (gun && gunKey(k.ts) !== gun) return false;
    if (tur && k.tablo !== tur) return false;
    // "Kaydetme" satırları yalnız özet; ayrıntı zaten ayrı satırlarda
    if (!ozetGoster && k.tablo === "(tam kayit)") return false;
    return true;
  }), [kayitlar, kisi, gun, tur, ozetGoster]);

  // güne göre grupla
  const gruplar = useMemo(() => {
    const m = new Map<string, Degisiklik[]>();
    for (const k of gorunen) {
      const g = gunKey(k.ts);
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(k);
    }
    return [...m.entries()];
  }, [gorunen]);

  return (
    <>
      <div className="toolbar dg-filtre">
        <select value={gun} onChange={(e) => setGun(e.target.value)}>
          <option value="">Tüm günler</option>
          {gunler.map((g) => <option key={g} value={g}>{gunAd(g)}</option>)}
        </select>
        <select value={kisi} onChange={(e) => setKisi(e.target.value)}>
          <option value="">Herkes</option>
          {kisiler.map((k) => <option key={k}>{k}</option>)}
        </select>
        <select value={tur} onChange={(e) => setTur(e.target.value)}>
          <option value="">Tüm değişiklik türleri</option>
          {turler.map((t) => <option key={t} value={t}>{BASLIK[t] ?? t}</option>)}
        </select>
        <label className="pf-check">
          <input type="checkbox" checked={ozetGoster}
            onChange={(e) => setOzetGoster(e.target.checked)} />
          Kaydetme özetlerini de göster
        </label>
        <div className="spacer" />
        <span className="pf-count">{gorunen.length} kayıt</span>
      </div>

      {gruplar.length === 0 && (
        <div className="empty">Bu filtreye uyan kayıt yok.</div>
      )}

      {gruplar.map(([g, satirlar]) => {
        const kisiSayisi = new Set(satirlar.map((s) => s.kullanici)).size;
        return (
          <section key={g} className="dg-gun">
            <h3>
              {gunAd(g)}
              <span className="tk-rozet">{satirlar.length} değişiklik</span>
              <span className="pf-muted">{kisiSayisi} kişi</span>
            </h3>
            <table className="pf-table dg-tablo">
              <thead>
                <tr>
                  <th className="w-saat">Saat</th>
                  <th>Kim</th>
                  <th>Ne</th>
                  <th>Kayıt</th>
                  <th>Değişiklik</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((k) => (
                  <tr key={k.id}>
                    <td className="dg-ts">{saat(k.ts)}</td>
                    <td className="pf-name">{k.kullanici ?? "—"}</td>
                    <td>{BASLIK[k.tablo] ?? k.tablo}</td>
                    <td>
                      {k.cari_ad
                        ? <>{k.cari_ad} <span className="pf-sub">{k.kayit_id}</span></>
                        : <span className="pf-muted">{k.kayit_id === "-" ? "" : k.kayit_id}</span>}
                    </td>
                    <td>
                      {k.alan && <span className="dg-alan">{k.alan}</span>}
                      {k.eski
                        ? <span className="dg-eski">{k.eski}</span>
                        : (k.yeni && k.alan ? <span className="dg-eski">boş</span> : null)}
                      {(k.eski || k.alan) && k.yeni && <span className="dg-ok">→</span>}
                      {k.yeni
                        ? <span className="dg-yeni">{k.yeni}</span>
                        : (k.eski ? <span className="dg-yeni">boşaltıldı</span> : null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <div className="dg-not">
        En son 2.000 kayıt gösteriliyor, en yeni üstte. Alan bazlı kayıt
        2 Eylül 2026&apos;da devreye girdi; daha eski kaydetmelerde yalnız
        kimin ne zaman kaydettiği görünür.
      </div>
    </>
  );
}
