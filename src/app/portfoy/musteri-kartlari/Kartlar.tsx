"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { KartDetay, KartSatir, Temsilci, Tur } from "@/lib/portfoy-kart";
import type { Izin, Hatirlatma } from "@/lib/portfoy-izin";
import IzinDevir from "./IzinDevir";
import Hatirlatmalar from "./Hatirlatmalar";
import { hatirlatmaEkleAction, hatirlatmalarAction } from "./actions";
import {
  detayAction, notEkleAction, notGecerlilikAction,
  yedekEkleAction, yedekSilAction, yedekYetkinlikAction, yedekSiraAction,
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

type Hizli = "hepsi" | "yedeksiz" | "notsuz" | "dikkat" | "hazirsiz";

type Sekme = "musteriler" | "izin" | "hatirlatma";

export default function Kartlar({ liste, turler: ilkTurler, temsilciler, yazar, izinler, hatirlatmalar: ilkHat }: {
  liste: KartSatir[]; turler: Tur[]; temsilciler: Temsilci[]; yazar: boolean;
  izinler: Izin[]; hatirlatmalar: Hatirlatma[];
}) {
  const [sekme, setSekme] = useState<Sekme>("musteriler");
  const [hatListesi, setHatListesi] = useState<Hatirlatma[]>(ilkHat);
  const hatUyari = hatListesi.filter((h) => !h.yapildi && h.gecikme >= -7).length;
  const [hatForm, setHatForm] = useState(false);
  const [hatTarih, setHatTarih] = useState(new Date().toISOString().slice(0, 10));
  const [hatMetin, setHatMetin] = useState("");
  // Hatırlatmalar sekmesine her geçişte listeyi tazele (tahtadan/karttan eklenenler görünsün)
  useEffect(() => {
    if (sekme !== "hatirlatma") return;
    hatirlatmalarAction().then((r) => { if (r.ok) setHatListesi(r.veri); });
  }, [sekme]);
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
      hazirsiz: s.filter((c) => c.aktif && c.yedek > 0 && c.not > 0 && (c.hazirlik ?? 0) < 80).length,
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
      if (hizli === "hazirsiz" && !(c.aktif && c.yedek > 0 && c.not > 0 && (c.hazirlik ?? 0) < 80)) return false;
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
        hazirlik: d.yedekler.length ? Math.max(...d.yedekler.map((y) => y.hazirlik.yuzde)) : null,
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
    <div className="mk-govde">
    <div className="mk-sekmeler">
      {([["musteriler", "Müşteriler"], ["izin", "İzin & Devir"], ["hatirlatma", "Hatırlatmalar"]] as [Sekme, string][]).map(([k, ad]) => (
        <button type="button" key={k} className={"mk-sekme" + (sekme === k ? " on" : "")} onClick={() => setSekme(k)}>
          {ad}{k === "izin" && izinler.filter((i) => i.durum !== "bitti").length > 0 && <span className="say mavi">{izinler.filter((i) => i.durum !== "bitti").length}</span>}
          {k === "hatirlatma" && hatUyari > 0 && <span className="say">{hatUyari}</span>}
        </button>))}
    </div>
    {mesaj && sekme !== "musteriler" && <div className={"tk-mesaj mk-ust-mesaj " + (mesaj.tip === "ok" ? "vy-basarili" : "tk-hata")}>{mesaj.metin}</div>}
    {sekme === "izin" && <IzinDevir ilkIzinler={izinler} temsilciler={temsilciler} turler={turler} yazar={yazar} mesajVer={setMesaj} />}
    {sekme === "hatirlatma" && <div className="iz-lyt"><Hatirlatmalar ilk={hatListesi} yazar={yazar} mesajVer={setMesaj} onDegis={setHatListesi} /></div>}
    <div className="mk-lyt" hidden={sekme !== "musteriler"}>
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
          {([["hepsi", "Hepsi"], ["yedeksiz", "Yedeği yok"], ["notsuz", "Notu yok"], ["dikkat", "Dikkat notu var"], ["hazirsiz", "Yedeği hazır değil"]] as [Hizli, string][])
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
                {c.yedek > 0 && c.not > 0 && c.hazirlik !== null && <span className={"r " + (c.hazirlik >= 80 ? "var" : "yok")}>hazır %{c.hazirlik}</span>}
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

            {detay.izinler.map((z, i) => (
              <div key={i} className={"mk-izin-serit " + z.durum}>
                {z.durum === "suruyor"
                  ? <>Bu müşteriye şu an <b>{z.bakan ?? "kimse seçilmedi"}</b> bakıyor — {z.temsilci} izinde, {tarih(z.baslangic)} – {tarih(z.bitis)}.</>
                  : <>{z.temsilci} <b>{tarih(z.baslangic)} – {tarih(z.bitis)}</b> tarihlerinde izinli; bu müşteriye {z.bakan ? <b>{z.bakan}</b> : <b>henüz kimse</b>} bakacak.</>}
                {!z.bakan && yazar && <button type="button" className="mk-link" onClick={() => setSekme("izin")}>İzin &amp; Devir'de seç →</button>}
              </div>))}
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
              <h3>Yedek temsilciler <span className="aciklama">asıl temsilci yokken kim bakabilir · sıralı, sayı sınırsız · puana girmez</span></h3>
              {detay.yedekler.length === 0 && <div className="mk-bos kucuk">Henüz yedek seçilmedi.</div>}
              <div className="mk-yedekler">
                {detay.yedekler.map((y, i) => (
                  <div key={y.temsilci_id} className="mk-yedek">
                    <div className="ust">
                      <span className="no">{i + 1}. YEDEK</span>
                      <b className="ad">{y.ad}</b>
                      <span className="ipucu">{ekipAd(y.ekip) || "ekip —"} · puanı {nf(y.puan)} · {nf(y.cari_sayisi)} cari
                        {detay.ekip && y.ekip && y.ekip !== detay.ekip && <b className="uyari"> · farklı ekip</b>}</span>
                      {yazar && <span className="islem">
                        <button type="button" className="mk-link" disabled={bekle || i === 0} title="yukarı"
                                onClick={() => baslat(async () => uygula(await yedekSiraAction(detay.kod, y.temsilci_id, "yukari")))}>▲</button>
                        <button type="button" className="mk-link" disabled={bekle || i === detay.yedekler.length - 1} title="aşağı"
                                onClick={() => baslat(async () => uygula(await yedekSiraAction(detay.kod, y.temsilci_id, "asagi")))}>▼</button>
                        <button type="button" className="mk-link sil" disabled={bekle}
                                onClick={() => { if (confirm(y.ad + " yedeklikten çıkarılsın mı?")) baslat(async () => uygula(await yedekSilAction(detay.kod, y.temsilci_id))); }}>çıkar</button>
                      </span>}
                    </div>
                    <div className="pm-hazir-satir">
                      {y.hazirlik.toplam === 0 ? <span className="kucuk">müşteride not yok — değerlendirecek bir şey yok</span> : <>
                        <span className="pm-hazir" title={`${y.hazirlik.tam} tam · ${y.hazirlik.aktarim} aktarım · ${y.hazirlik.yok} fikri yok · ${y.hazirlik.bekleyen} değerlendirilmedi`}>
                          {Array.from({ length: y.hazirlik.tam }, (_, k) => <i key={"t" + k} className="t" />)}
                          {Array.from({ length: y.hazirlik.aktarim }, (_, k) => <i key={"a" + k} className="a" />)}
                          {Array.from({ length: y.hazirlik.yok }, (_, k) => <i key={"y" + k} className="y" />)}
                          {Array.from({ length: y.hazirlik.bekleyen }, (_, k) => <i key={"d" + k} className="d" />)}
                          <b>%{y.hazirlik.yuzde} hazır</b></span>
                        <span className="kucuk">{y.hazirlik.tam} tam · {y.hazirlik.aktarim} aktarım gerekli · {y.hazirlik.yok} fikri yok{y.hazirlik.bekleyen ? ` · ${y.hazirlik.bekleyen} değerlendirilmedi` : ""}</span></>}
                    </div>
                    <textarea className="yetkinlik" defaultValue={y.yetkinlik ?? ""} disabled={!yazar || bekle}
                              placeholder="Bu yedek neleri yapabilir? (ör. sevkiyat ve ASN'yi bilir, fatura sürecini bilmez) · odak çıkınca veya Ctrl+Enter ile kaydolur"
                              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) (e.target as HTMLTextAreaElement).blur(); }}
                              onBlur={(e) => { if ((e.target.value.trim() || "") !== (y.yetkinlik ?? ""))
                                baslat(async () => uygula(await yedekYetkinlikAction(detay.kod, y.temsilci_id, e.target.value))); }} />
                  </div>
                ))}
              </div>
              {yazar && (
                <div className="mk-yedek-ekle">
                  <select value="" disabled={bekle}
                          onChange={(e) => { const v = Number(e.target.value); if (v) baslat(async () => uygula(await yedekEkleAction(detay.kod, v))); }}>
                    <option value="">+ yedek ekle…</option>
                    {temsilciler
                      .filter((t) => !detay.temsilci.startsWith(t.ad) && !detay.yedekler.some((y) => y.temsilci_id === t.id))
                      .map((t) => <option key={t.id} value={t.id}>{t.ad}{t.ekip ? " · " + ekipAd(t.ekip) : ""}</option>)}
                  </select>
                  <span className="kucuk">Sıra önceliktir: izinde önce 1. yedek denenir. Süreç bilgisi notlarda; buraya yalnız bu kişinin neyi bildiğini yaz.</span>
                </div>
              )}
            </div>

            {/* ---- hatırlatmalar ---- */}
            <div className="mk-bolum">
              <h3>Hatırlatmalar <span className="aciklama">tarihli yapılacaklar · bakan kişiye düşer</span>
                {yazar && <button type="button" className="mk-link" onClick={() => { setHatForm((v) => !v); setHatMetin(""); }}>{hatForm ? "vazgeç" : "+ hatırlatma"}</button>}</h3>
              {detay.hatirlatmalar.length === 0 && !hatForm && <div className="mk-bos kucuk">Bekleyen hatırlatma yok.</div>}
              {detay.hatirlatmalar.map((h) => (
                <div key={h.id} className={"mk-hat" + (h.yapildi ? " yapildi" : "")}>
                  <span className="tar">{tarih(h.tarih)}</span><span>{h.metin}</span>
                  <span className="kucuk">{h.sorumlu ?? ""}{h.yapildi ? " · yapıldı ✓" : ""}</span>
                </div>))}
              {hatForm && (
                <div className="iz-mini-form" style={{ marginTop: 8 }}>
                  <input type="date" value={hatTarih} onChange={(e) => setHatTarih(e.target.value)} />
                  <input value={hatMetin} onChange={(e) => setHatMetin(e.target.value)} placeholder="ne yapılacak?" />
                  <button type="button" className="btn" disabled={!hatMetin.trim() || bekle}
                          onClick={() => baslat(async () => {
                            const r = await hatirlatmaEkleAction(detay.kod, hatTarih, hatMetin, null, null);
                            if (r.ok) { setHatForm(false); setMesaj({ tip: "ok", metin: r.mesaj ?? "" }); const d = await detayAction(detay.kod); if (d.ok) setDetay(d.veri); }
                            else setMesaj({ tip: "hata", metin: r.hata });
                          })}>Ekle</button>
                </div>)}
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
                      <b>{x.tur}{x.izin && <span className="devir"> · devir notu · {x.izin}</span>}{!x.gecerli && <span className="gecersiz"> · geçersiz</span>}</b>
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
