"use client";

import { useMemo, useState, useTransition } from "react";
import { alanGuncelleAction } from "../actions";
import { ALANLAR, type AlanAdi, type CariSatir } from "./tipler";

const nf = (n: number, b = 1) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: b });
const ni = (n: number) => Math.round(n).toLocaleString("tr-TR");

// Tabloda düzenlenebilir kolonlar — sıra ekrandaki sıradır.
const KOLONLAR: { alan: AlanAdi; baslik: string; genis?: boolean }[] = [
  { alan: "segment", baslik: "Segment", genis: true },
  { alan: "onem", baslik: "Önem" },
  { alan: "zorluk", baslik: "Zorluk" },
  { alan: "siparis_tipi", baslik: "Sipariş" },
  { alan: "kim_oduyor", baslik: "Kim ödüyor" },
  { alan: "ekipman", baslik: "Ekipman" },
  { alan: "portal", baslik: "Portal", genis: true },
  { alan: "etiket", baslik: "Etiket" },
  { alan: "asn", baslik: "ASN" },
];

type Props = { satirlar: CariSatir[]; duzenlenebilir: boolean };

export default function CariTablo({ satirlar, duzenlenebilir }: Props) {
  const [veri, setVeri] = useState(satirlar);
  const [ara, setAra] = useState("");
  const [kanal, setKanal] = useState("");
  const [temsilci, setTemsilci] = useState("");
  const [yalnizEksik, setYalnizEksik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [, basla] = useTransition();

  const temsilciler = useMemo(() => {
    const set = new Set<string>();
    for (const c of veri) {
      for (const t of (c.temsilciler ?? "").split(" · ")) {
        const ad = t.replace(/ %\d+$/, "").trim();
        if (ad) set.add(ad);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [veri]);

  const gorunen = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase("tr");
    return veri.filter((c) => {
      if (q && !c.cari_ad.toLocaleLowerCase("tr").includes(q) && !c.cari_kod.includes(q)) return false;
      if (kanal && String(c.kanal) !== kanal) return false;
      if (temsilci && !(c.temsilciler ?? "").includes(temsilci)) return false;
      if (yalnizEksik && c.bos_hucre === 0) return false;
      return true;
    });
  }, [veri, ara, kanal, temsilci, yalnizEksik]);

  const bosToplam = veri.reduce((a, c) => a + c.bos_hucre, 0);

  async function degistir(c: CariSatir, alan: AlanAdi, yeni: string) {
    const eski = (c[alan] ?? "") === null ? "" : String(c[alan] ?? "");
    if (yeni === eski) return;
    setHata(null);
    setBekleyen(`${c.cari_kod}:${alan}`);

    // İyimser güncelleme — sunucu reddederse geri alınır.
    setVeri((ö) => ö.map((x) => (x.cari_kod === c.cari_kod ? { ...x, [alan]: yeni || null } : x)));

    const sonuc = await alanGuncelleAction(c.cari_kod, alan, yeni, eski);
    setBekleyen(null);
    if (!sonuc.ok) {
      setVeri((ö) => ö.map((x) => (x.cari_kod === c.cari_kod ? { ...x, [alan]: eski || null } : x)));
      setHata(sonuc.error);
      return;
    }
    // Yük/puan değerleri view'lerden gelir; sayfayı tazeleyip yeniden okutuyoruz.
    basla(() => { /* revalidatePath sunucu tarafında yapıldı */ });
  }

  return (
    <>
      <div className="toolbar pf-toolbar">
        <div className="search">
          <input
            placeholder="Müşteri adı veya cari kodu…"
            value={ara}
            onChange={(e) => setAra(e.target.value)}
          />
        </div>
        <select value={kanal} onChange={(e) => setKanal(e.target.value)} className="pf-sel">
          <option value="">Tüm kanallar</option>
          <option value="10">Yurtiçi</option>
          <option value="20">Yurtdışı</option>
        </select>
        <select value={temsilci} onChange={(e) => setTemsilci(e.target.value)} className="pf-sel">
          <option value="">Tüm temsilciler</option>
          {temsilciler.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="pf-check">
          <input type="checkbox" checked={yalnizEksik} onChange={(e) => setYalnizEksik(e.target.checked)} />
          Yalnız eksikler
        </label>
        <div className="spacer" />
        <span className="pf-count">
          {ni(gorunen.length)} / {ni(veri.length)} cari · {ni(bosToplam)} boş hücre
        </span>
      </div>

      {hata && <div className="pf-err">{hata}</div>}

      <div className="card pf-card">
        <div className="pf-scroll pf-scroll-tall">
          <table className="pf-table pf-table-wide">
            <thead>
              <tr>
                <th className="pf-sticky">Müşteri</th>
                <th>Temsilci</th>
                {KOLONLAR.map((k) => <th key={k.alan}>{k.baslik}</th>)}
                <th className="num">Sevk.</th>
                <th className="num">Nokta</th>
                <th className="num">Malz.</th>
                <th className="num">Yük</th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map((c) => (
                <tr key={c.cari_kod}>
                  <td className="pf-sticky">
                    <div className="pf-name">{c.cari_ad}</div>
                    <div className="pf-sub">
                      {c.cari_kod} · {c.kanal === 20 ? "Yurtdışı" : "Yurtiçi"}
                      {c.bos_hucre > 0 && <span className="pf-gap"> {c.bos_hucre} eksik</span>}
                    </div>
                  </td>
                  <td className="pf-muted">{c.temsilciler ?? "—"}</td>
                  {KOLONLAR.map((k) => {
                    const deger = c[k.alan] === null ? "" : String(c[k.alan]);
                    const bos = deger === "";
                    const anahtar = `${c.cari_kod}:${k.alan}`;
                    return (
                      <td key={k.alan} className={bos ? "pf-empty-cell" : ""}>
                        <select
                          className={`pf-cell ${k.genis ? "pf-cell-wide" : ""}`}
                          value={deger}
                          disabled={!duzenlenebilir || bekleyen === anahtar}
                          onChange={(e) => degistir(c, k.alan, e.target.value)}
                        >
                          <option value="">—</option>
                          {(ALANLAR[k.alan] as readonly string[]).map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td className="num">{ni(c.sv)}</td>
                  <td className="num">{ni(c.nl)}</td>
                  <td className="num">{ni(c.gm)}</td>
                  <td className="num pf-strong">{nf(c.yuk, 2)}</td>
                </tr>
              ))}
              {gorunen.length === 0 && (
                <tr><td colSpan={14} className="empty">Filtreye uyan cari yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
