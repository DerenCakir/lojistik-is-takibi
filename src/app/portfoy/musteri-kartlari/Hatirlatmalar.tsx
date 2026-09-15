"use client";

import { useEffect, useState, useTransition } from "react";
import type { Hatirlatma } from "@/lib/portfoy-izin";
import { hatirlatmaDurumAction, hatirlatmaSilAction } from "./actions";

type Mesaj = { tip: "ok" | "hata"; metin: string } | null;
const tr = (s: string) => { const [y, m, g] = s.split("-"); return `${g}.${m}.${y}`; };

/** Geçmiş / Bugün / Bu hafta / Sonra / Yapılanlar. Bildirim yok; sayfa açılınca görünür. */
export default function Hatirlatmalar({ ilk, yazar, mesajVer, onDegis }: {
  ilk: Hatirlatma[]; yazar: boolean; mesajVer: (m: Mesaj) => void; onDegis: (h: Hatirlatma[]) => void;
}) {
  const [liste, setListe] = useState<Hatirlatma[]>(ilk);
  useEffect(() => { setListe(ilk); }, [ilk]);
  const [bekle, baslat] = useTransition();
  const uygula = (r: { ok: true; veri: Hatirlatma[] } | { ok: false; hata: string }) => {
    if (r.ok) { setListe(r.veri); onDegis(r.veri); } else mesajVer({ tip: "hata", metin: r.hata });
  };
  const bekleyen = liste.filter((h) => !h.yapildi);
  const gruplar: [string, Hatirlatma[], string][] = [
    ["Geçmiş", bekleyen.filter((h) => h.gecikme > 0), "gec"],
    ["Bugün", bekleyen.filter((h) => h.gecikme === 0), "bugun"],
    ["Bu hafta", bekleyen.filter((h) => h.gecikme < 0 && h.gecikme >= -7), ""],
    ["Sonra", bekleyen.filter((h) => h.gecikme < -7), ""],
    ["Yapılanlar · son 14 gün", liste.filter((h) => h.yapildi), "yapildi"],
  ];

  return (
    <div className="iz-kart">
      {bekleyen.length === 0 && <div className="mk-bos">Bekleyen hatırlatma yok.</div>}
      {gruplar.filter(([, l]) => l.length).map(([ad, l, cls]) => (
        <div key={ad} className="ht-grup">
          <h4>{ad} · {l.length}</h4>
          {l.map((h) => (
            <div key={h.id} className={"ht-sat " + cls}>
              <input type="checkbox" checked={h.yapildi} disabled={!yazar || bekle}
                     onChange={(e) => baslat(async () => uygula(await hatirlatmaDurumAction(h.id, e.target.checked)))} />
              <span className="tar">{tr(h.tarih)}</span>
              <span><b>{h.cari_ad}</b> — {h.metin}
                <span className="kim"> · {h.izin ? `${h.izin} izninden` : h.olusturan ?? ""}{h.sorumlu ? ` · bakan: ${h.sorumlu}` : ""}{h.yapildi && h.yapan ? ` · yaptı: ${h.yapan}` : ""}</span></span>
              <span className="sag">
                {!h.yapildi && h.gecikme > 0 && <span className="r kirmizi">{h.gecikme} gün gecikti</span>}
                {!h.yapildi && h.gecikme === 0 && <span className="r sari">bugün</span>}
                {!h.yapildi && h.gecikme < 0 && h.sorumlu && <span className="r mavi">{h.sorumlu.split(" ")[0]}</span>}
                {yazar && <button type="button" className="mk-link" disabled={bekle} title="Sil"
                                  onClick={() => { if (confirm("Hatırlatma silinsin mi?")) baslat(async () => uygula(await hatirlatmaSilAction(h.id))); }}>sil</button>}
              </span>
            </div>
          ))}
        </div>
      ))}
      <div className="kucuk" style={{ marginTop: 8 }}>E-posta/bildirim altyapısı yok: hatırlatmalar sayfa açılınca görünür. Sekmedeki sayı gecikmiş + bugün + bu haftakileri gösterir. Hatırlatma eklemek için İzin &amp; Devir tahtasındaki satırı ya da müşteri kartını kullan.</div>
    </div>
  );
}
