"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { KartDetay, KartSatir, Temsilci, Tur } from "@/lib/portfoy-kart";
import {
  detayAction, notEkleAction, notGecerlilikAction, yedekAction,
  turEkleAction, turGuncelleAction,
} from "./actions";

/* ---------- küçük yardımcılar ---------- */
const nf = (v: number, d = 1) => v.toLocaleString("tr-TR", { maximumFractionDigits: d });
const ni = (v: number) => v.toLocaleString("tr-TR");
const tarih = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};
const ekipAd = (e: string | null) => e === "YD" ? "Yurtdışı" : e === "YI" ? "Yurtiçi" : "";

type Hizli = "hepsi" | "yedeksiz" | "notsuz" | "dikkat";

export default function Kartlar({ liste, turler: ilkTurler, temsilciler, yazar }: {
  liste: KartSatir[]; turler: Tur[]; temsilciler: Temsilci[]; yazar: boolean;
}) {
  const [ara, setAra] = useState("");
  const [fTem, setFTem] = useState("");
  const [fEkip, setFEkip] = useState("");
  const [hizli, setHizli] = useState<Hizli>("hepsi");
  const [secili, setSecili] = useState<string>(liste[0]?.kod ?? "");
  const [detay, setDetay] = useState<KartDetay | null>(null);
  const [turler, setTurler] = useState<Tur[]>(ilkTurler);
  const [mesaj, setMesaj] = useState<{ tip: "ok" | "hata"; metin: string } | null>(null);
  const [basliklarAcik, setBasliklarAcik] = useState(false);
  const [bekle, baslat] = useTransition();
  const [rozetler, setRozetler] = useState<Record<string, Partial<KartSatir>>>({});

  // "A %85 · B %15" gibi bölüşümleri kişilere ayır; filtre kişi adına göre çalışır
  const kisiler = (t: string) => t.split(" · ").map((x) => x.replace(/ %\d+$/, "").trim()).filter(Boolean);
  const temsilciAdlari = useMemo(
    () => [...new Set(liste.flatMap((c) => kisiler(c.temsilci)))].sort((a, b) => a.localeCompare(b, "tr")),
    [liste]);

  // liste satırının rozetleri detaydan güncellenir (kaydetmeden sonra liste yeniden çekilmez)
  const satir = (c: KartSatir): KartSatir => ({ ...c, ...(rozetler[c.kod] ?? {}) });

  const sayilar = useMemo(() => {
    const s = liste.map(satir);
    return {
      hepsi: s.length,
      yedeksiz: s.filter((c) => c.yedek === 0 && c.aktif).length,
      notsuz: s.filter((c) => c.not === 0 && c.aktif).length,
      dikkat: s.filter((c) => c.dikkat).length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste, rozetler]);

  const gorunen = useMemo(() => {
    const q = ara.trim().toLowerCase();
    return liste.map(satir).filter((c) => {
      if (q && !c.ad.toLowerCase().includes(q) && !c.kod.includes(q)) return false;
      if (fTem && !kisiler(c.temsilci).includes(fTem)) return false;
      if (fEkip && c.ekip !== fEkip) return false;
      if (hizli === "yedeksiz" && !(c.yedek === 0 && c.aktif)) return false;
      if (hizli === "notsuz" && !(c.not === 0 && c.aktif)) return false;
      if (hizli === "dikkat" && !c.dikkat) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste, ara, fTem, fEkip, hizli, rozetler]);

  // seçilen kartın detayını çek
  useEffect(() => {
    if (!secili) { setDetay(null); return; }
    let iptal = false;
    setMesaj(null);
    detayAction(secili).then((r) => {
      if (iptal) return;
      if (r.ok) setDetay(r.veri); else setMesaj({ tip: "hata", metin: r.hata });
    });
    return () => { iptal = true; };
  }, [secili]);

  // detay sonucunu uygula + liste rozetlerini tazele
  const uygula = (r: Awaited<ReturnType<typeof notEkleAction>>) => {
    if (!r.ok) { setMesaj({ tip: "hata", metin: r.hata }); return; }
    setDetay(r.veri);
    if (r.mesaj) setMesaj({ tip: "ok", metin: r.mesaj });
    if (r.veri) {
      const d = r.veri;
      setRozetler((x) => ({ ...x, [d.kod]: {
        yedek: d.yedekler.length,
        not: d.notlar.filter((n) => n.gecerli).length,
        dikkat: d.notlar.some((n) => n.gecerli && n.onemli),
      } }));
    }
  };

  /* ---------- not ekleme formu ---------- */
  const [yeniTur, setYeniTur] = useState<string>("");
  const [yeniMetin, setYeniMetin] = useState("");
  const aktifTurler = turler.filter((t) => t.aktif);

  const notGonder = () => {
    if (!detay || !yeniMetin.trim()) return;
    const kod = detay.kod, turId = yeniTur ? Number(yeniTur) : null, metin = yeniMetin;
    baslat(async () => {
      const r = await notEkleAction(kod, turId, metin);
      uygula(r);
      if (r.ok) setYeniMetin("");
    });
  };

  return (
    <div className="mk-lyt">
      {/* ---------------- SOL: liste ---------------- */}
      <aside className="mk-liste">
        <input className="mk-ara" placeholder="müşteri adı veya cari kodu ara…"
               value={ara} onChange={(e) => setAra(e.target.value)} />
        <div className="mk-filt">
          <select value={fTem} onChange={(e) => setFTem(e.target.value)}>
            <option value="">Temsilci: hepsi</option>
            {temsilciAdlari.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fEkip} onChange={(e) => setFEkip(e.target.value)}>
            <option value="">Ekip: hepsi</option>
            <option value="YI">Yurtiçi</option>
            <option value="YD">Yurtdışı</option>
          </select>
        </div>
        <div className="mk-hizli">
          {([["hepsi", "Hepsi"], ["yedeksiz", "Yedeği yok"], ["notsuz", "Notu yok"], ["dikkat", "Dikkat notu var"]] as [Hizli, string][])
            .map(([k, ad]) => (
              <button key={k} type="button" className={hizli === k ? "on" : ""} onClick={() => setHizli(k)}>
                {ad} · {sayilar[k]}
              </button>))}
        </div>
        <div className="mk-satirlar">
          {gorunen.length === 0 && <div className="mk-bos">Bu filtreye uyan müşteri yok.</div>}
          {gorunen.map((c) => (
            <div key={c.kod} className={"mk-sat" + (c.kod === secili ? " on" : "") + (c.aktif ? "" : " pasif")}
                 onClick={() => setSecili(c.kod)} role="button" tabIndex={0}
                 onKeyDown={(e) => { if (e.key === "Enter") setSecili(c.kod); }}>
              <div>
                <div className="ad">{c.ad}</div>
                <div className="kod">{c.kod}</div>
                <div className="tem">{c.temsilci || "temsilci atanmamış"}{c.ekip ? ` · ${ekipAd(c.ekip)}` : ""}</div>
              </div>
              <div className="roz">
                {c.dikkat && <span className="r dikkat">!</span>}
                {c.yedek ? <span className="r var">{c.yedek} yedek</span> : (c.aktif && <span className="r yok">yedek yok</span>)}
                {c.not > 0 && <span className="r n">{c.not} not</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ---------------- SAĞ: kart ---------------- */}
      <section className="mk-detay">
        {!detay && <div className="mk-bos">{secili ? "Yükleniyor…" : "Soldan bir müşteri seç."}</div>}
        {detay && (
          <>
            <div className="mk-bas">
              <h2>{detay.ad}</h2>
              <div className="meta">
                <span className="badge">{detay.kod}</span>
                <span className="badge">{detay.kanal === 20 ? "Yurtdışı 20" : detay.kanal === 10 ? "Yurtiçi 10" : "kanal —"}</span>
                <span className={"badge " + (detay.aktif ? "yesil" : "kirmizi")}>{detay.aktif ? "Aktif" : "Pasif"}</span>
                <span className="badge mavi">{detay.temsilci || "temsilci atanmamış"}</span>
                {detay.segment && <span className="badge">{detay.segment}</span>}
                {detay.zorunlu > 0 && <span className="badge">{detay.zorunlu} zorunlu ek iş</span>}
              </div>
            </div>

            <div className="mk-canli">
              <span className="etiket">● canlı · ana portaldan</span>
              <div><div className="k">Yük katkısı</div><div className="v">{nf(detay.yuk)}</div></div>
              <div><div className="k">Temsilci puanı</div><div className="v">{detay.puan === null ? "—" : nf(detay.puan)}</div></div>
              <div><div className="k">Teslim noktası</div><div className="v">{ni(detay.nokta)} <small>/ {ni(detay.noktaAktif)} sevkiyatlı</small></div></div>
              <div><div className="k">Sevkiyat</div><div className="v">{ni(detay.sevkiyat)}</div></div>
              <div><div className="k">Son değişiklik</div>
                <div className="v kucuk">{detay.sonDegisiklik ? `${tarih(detay.sonDegisiklik.ts)} · ${detay.sonDegisiklik.kullanici ?? "?"}` : "—"}</div></div>
            </div>

            {mesaj && <div className={"tk-mesaj " + (mesaj.tip === "ok" ? "vy-basarili" : "tk-hata")}>{mesaj.metin}</div>}

            {/* ---- yedekler ---- */}
            <div className="mk-bolum">
              <h3>Yedek temsilciler <span className="aciklama">asıl temsilci yokken kim bakabilir · puana girmez</span></h3>
              <div className="mk-yedekler">
                {([1, 2] as const).map((sira) => {
                  const y = detay.yedekler.find((x) => x.sira === sira);
                  return (
                    <div key={sira} className={"mk-yedek" + (y ? "" : " bos")}>
                      <div className="no">{sira}. YEDEK</div>
                      <select value={y?.temsilci_id ?? ""} disabled={!yazar || bekle}
                              onChange={(e) => {
                                const v = e.target.value ? Number(e.target.value) : null;
                                baslat(async () => uygula(await yedekAction(detay.kod, sira, v)));
                              }}>
                        <option value="">— seçilmedi —</option>
                        {temsilciler
                          .filter((t) => !detay.temsilci.startsWith(t.ad))
                          .map((t) => <option key={t.id} value={t.id}>{t.ad}{t.ekip ? ` · ${ekipAd(t.ekip)}` : ""}</option>)}
                      </select>
                      <div className="ipucu">
                        {y ? `${ekipAd(y.ekip) || "ekip —"} · puanı ${nf(y.puan)} · ${nf(y.cari_sayisi)} cari`
                           : (yazar ? "Bu müşteriye bakabilecek ikinci kişi." : "Seçilmemiş.")}
                        {y && detay.ekip && y.ekip && y.ekip !== detay.ekip && <b className="uyari"> · farklı ekip</b>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ---- notlar ---- */}
            <div className="mk-bolum">
              <h3>Notlar <span className="aciklama">süreçler ve özel bilgiler · silinmez, eskiyen geçersiz işaretlenir</span>
                {yazar && <button type="button" className="mk-link" onClick={() => setBasliklarAcik((v) => !v)}>
                  {basliklarAcik ? "Başlıkları kapat" : "Başlıkları yönet"}</button>}
              </h3>

              {basliklarAcik && yazar && (
                <Basliklar turler={turler} onDegis={setTurler} setMesaj={setMesaj} />
              )}

              <div className="mk-notlar">
                {detay.notlar.length === 0 && <div className="mk-bos kucuk">Bu müşteri için henüz not yok.</div>}
                {detay.notlar.map((x) => (
                  <div key={x.id} className={"mk-not" + (x.gecerli ? "" : " eski") + (x.onemli && x.gecerli ? " dikkat" : "")}>
                    <div className="nb">
                      <b>{x.tur}{!x.gecerli && <span className="gecersiz"> · geçersiz</span>}</b>
                      <span className="kim">{x.yazan ?? "?"} · {tarih(x.ts)}</span>
                      {yazar && (
                        <button type="button" className="mk-link" disabled={bekle}
                                onClick={() => baslat(async () => uygula(await notGecerlilikAction(detay.kod, x.id, !x.gecerli)))}>
                          {x.gecerli ? "geçersiz yap" : "geri al"}
                        </button>)}
                    </div>
                    <p>{x.metin}</p>
                  </div>
                ))}
              </div>

              {yazar && (
                <div className="mk-ekle">
                  <div className="satir">
                    <select value={yeniTur} onChange={(e) => setYeniTur(e.target.value)}>
                      <option value="">Başlık seç…</option>
                      {aktifTurler.map((t) => <option key={t.id} value={t.id}>{t.onemli ? "⚠ " : ""}{t.ad}</option>)}
                    </select>
                    <textarea value={yeniMetin} onChange={(e) => setYeniMetin(e.target.value)}
                              placeholder="Notu yaz… (Ctrl+Enter kaydeder)"
                              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) notGonder(); }} />
                  </div>
                  <div className="alt">
                    <button type="button" className="btn primary" disabled={!yeniMetin.trim() || bekle} onClick={notGonder}>
                      {bekle ? "Kaydediliyor…" : "Notu kaydet"}
                    </button>
                    <span className="kucuk">Yalnız bu not kaydedilir; ana portaldaki verilere dokunulmaz.</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ---------- başlık yönetimi ---------- */
function Basliklar({ turler, onDegis, setMesaj }: {
  turler: Tur[]; onDegis: (t: Tur[]) => void;
  setMesaj: (m: { tip: "ok" | "hata"; metin: string } | null) => void;
}) {
  const [ad, setAd] = useState("");
  const [onemli, setOnemli] = useState(false);
  const [bekle, baslat] = useTransition();
  const sonuc = (r: { ok: true; veri: Tur[]; mesaj?: string } | { ok: false; hata: string }) => {
    if (r.ok) { onDegis(r.veri); if (r.mesaj) setMesaj({ tip: "ok", metin: r.mesaj }); }
    else setMesaj({ tip: "hata", metin: r.hata });
  };
  return (
    <div className="mk-basliklar">
      <div className="kucuk">Başlıklar ortak listedir; her müşteri istediğini kullanır. Pasif başlık yeni notlarda seçilemez, eski notlarda görünmeye devam eder.</div>
      <table className="pf-table mk-btbl">
        <thead><tr><th>Başlık</th><th>Öne çıkan</th><th>Kullanım</th><th>Durum</th></tr></thead>
        <tbody>
          {turler.map((t) => (
            <tr key={t.id} className={t.aktif ? "" : "pasif"}>
              <td><input defaultValue={t.ad} disabled={bekle}
                         onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.ad)
                           baslat(async () => sonuc(await turGuncelleAction(t.id, v, t.onemli, t.aktif))); }} /></td>
              <td><input type="checkbox" checked={t.onemli} disabled={bekle}
                         onChange={(e) => baslat(async () => sonuc(await turGuncelleAction(t.id, t.ad, e.target.checked, t.aktif)))} /></td>
              <td className="pf-muted">{t.kullanim} not</td>
              <td><button type="button" className="mk-link" disabled={bekle}
                          onClick={() => baslat(async () => sonuc(await turGuncelleAction(t.id, t.ad, t.onemli, !t.aktif)))}>
                {t.aktif ? "pasife al" : "aktif et"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mk-bekle">
        <input placeholder="Yeni başlık" value={ad} onChange={(e) => setAd(e.target.value)} />
        <label className="pf-check"><input type="checkbox" checked={onemli} onChange={(e) => setOnemli(e.target.checked)} /> öne çıkan (Dikkat! gibi)</label>
        <button type="button" className="btn" disabled={ad.trim().length < 2 || bekle}
                onClick={() => baslat(async () => { const r = await turEkleAction(ad, onemli); sonuc(r); if (r.ok) { setAd(""); setOnemli(false); } })}>
          Ekle
        </button>
      </div>
    </div>
  );
}
