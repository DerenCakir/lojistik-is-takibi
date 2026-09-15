"use client";

import { useEffect, useState, useTransition } from "react";
import type { BenimMusterim, YedegiOldugum, MusteriDetay, Hatirlatmam, Durum, Hazirlik } from "@/lib/portfoy-portfoyum";
import {
  detayAction, listelerAction, notEkleAction, notGecersizAction,
  yedekEkleAction, yedekSilAction, yedekSiraAction, degerlendirAction, hatirlatmaYapildiAction,
} from "./actions";

type Sekme = "benim" | "yedek" | "hat";
type Mesaj = { tip: "ok" | "hata"; metin: string } | null;
const tr = (s: string) => { const [y, m, g] = s.split("-"); return `${g}.${m}.${y}`; };
const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const kisa = (s: string) => { const [, m, g] = s.split("-"); return `${+g} ${AY[+m - 1]}`; };
const ekipAd = (e: string | null) => e === "YD" ? "Yurtdışı" : e === "YI" ? "Yurtiçi" : "";
const DURUM_AD: Record<Durum, string> = { tam: "bilgim tam", aktarim: "aktarım gerekli", yok: "hiç fikrim yok" };

/** Hazırlık çubuğu: yeşil tam · sarı aktarım · kırmızı yok · gri bekleyen */
function HazirlikCubuk({ h }: { h: Hazirlik }) {
  if (!h.toplam) return <span className="kucuk">not yok</span>;
  return (
    <span className="pm-hazir" title={`${h.tam} tam · ${h.aktarim} aktarım gerekli · ${h.yok} fikri yok · ${h.bekleyen} değerlendirilmedi`}>
      {Array.from({ length: h.tam }, (_, i) => <i key={"t" + i} className="t" />)}
      {Array.from({ length: h.aktarim }, (_, i) => <i key={"a" + i} className="a" />)}
      {Array.from({ length: h.yok }, (_, i) => <i key={"y" + i} className="y" />)}
      {Array.from({ length: h.bekleyen }, (_, i) => <i key={"d" + i} className="d" />)}
      <b>%{h.yuzde}</b>
    </span>
  );
}
const hazirRozet = (h: Hazirlik) =>
  !h.toplam ? <span className="r gri">notu yok</span>
  : h.yuzde >= 80 ? <span className="r yesil">yedek hazır %{h.yuzde}</span>
  : h.aktarim + h.yok > 0 ? <span className="r kirmizi">aktarım gerekli · {h.aktarim + h.yok}</span>
  : <span className="r sari">hazırlık %{h.yuzde}</span>;

export default function Portfoyum({ benimId, ilkBenim, ilkYedek, ilkHat, temsilciler }: {
  benimId: number; ilkBenim: BenimMusterim[]; ilkYedek: YedegiOldugum[]; ilkHat: Hatirlatmam[];
  temsilciler: { id: number; ad: string; ekip: string | null }[];
}) {
  const [sekme, setSekme] = useState<Sekme>("benim");
  const [benim, setBenim] = useState(ilkBenim);
  const [yedek, setYedek] = useState(ilkYedek);
  const [hat, setHat] = useState(ilkHat);
  const [secili, setSecili] = useState<string>(ilkBenim[0]?.kod ?? "");
  const [seciliY, setSeciliY] = useState<string>(ilkYedek.find((y) => y.yeni > 0)?.kod ?? ilkYedek[0]?.kod ?? "");
  const [detay, setDetay] = useState<MusteriDetay | null>(null);
  const [mesaj, setMesaj] = useState<Mesaj>(null);
  const [bekle, baslat] = useTransition();
  const [ara, setAra] = useState("");

  const aktifKod = sekme === "yedek" ? seciliY : secili;
  useEffect(() => {
    if (!aktifKod || sekme === "hat") { setDetay(null); return; }
    let iptal = false; setMesaj(null);
    detayAction(aktifKod).then((r) => { if (!iptal) { if (r.ok) setDetay(r.veri); else setMesaj({ tip: "hata", metin: r.hata }); } });
    return () => { iptal = true; };
  }, [aktifKod, sekme]);

  const listeleriTazele = async () => { const r = await listelerAction(); if (r.ok) { setBenim(r.veri.benim); setYedek(r.veri.yedek); setHat(r.veri.hat); } };
  const uygula = (r: { ok: true; veri: MusteriDetay | null; mesaj?: string } | { ok: false; hata: string }) => {
    if (!r.ok) { setMesaj({ tip: "hata", metin: r.hata }); return; }
    setDetay(r.veri); if (r.mesaj) setMesaj({ tip: "ok", metin: r.mesaj });
    listeleriTazele();
  };

  const yeniYedeklik = yedek.filter((y) => y.yeni > 0).length;
  const hatUyari = hat.filter((h) => !h.yapildi && h.gecikme >= -7).length;
  const yeniBildirim = yedek.filter((y) => y.hazirlik.bekleyen === y.hazirlik.toplam && y.hazirlik.toplam > 0);

  /* ---- not formu ---- */
  const [yeniTur, setYeniTur] = useState(""); const [yeniMetin, setYeniMetin] = useState("");
  const notGonder = () => { if (!detay || !yeniMetin.trim()) return;
    const kod = detay.kod, turId = yeniTur ? Number(yeniTur) : null, metin = yeniMetin;
    baslat(async () => { const r = await notEkleAction(kod, turId, metin); uygula(r); if (r.ok) setYeniMetin(""); }); };

  const q = ara.trim().toLowerCase();

  return (
    <>
      <div className="mk-sekmeler">
        <button type="button" className={"mk-sekme" + (sekme === "benim" ? " on" : "")} onClick={() => setSekme("benim")}>Müşterilerim · {benim.length}</button>
        <button type="button" className={"mk-sekme" + (sekme === "yedek" ? " on" : "")} onClick={() => setSekme("yedek")}>
          Yedeği olduğum müşteriler{yeniYedeklik > 0 && <span className="say">{yeniYedeklik} değerlendirilmedi</span>}</button>
        <button type="button" className={"mk-sekme" + (sekme === "hat" ? " on" : "")} onClick={() => setSekme("hat")}>
          Hatırlatmalarım{hatUyari > 0 && <span className="say">{hatUyari}</span>}</button>
      </div>

      {mesaj && <div className={"tk-mesaj mk-ust-mesaj " + (mesaj.tip === "ok" ? "vy-basarili" : "tk-hata")}>{mesaj.metin}</div>}

      {/* ================= MÜŞTERİLERİM ================= */}
      {sekme === "benim" && (
        <div className="iz-lyt">
          {yeniBildirim.length > 0 && (
            <div className="pm-bildirim">🔔 <span>
              {yeniBildirim.slice(0, 3).map((y, i) => <span key={y.kod}>{i > 0 && " · "}<b>{y.asil}</b> seni <b>{y.ad}</b> için yedek belirledi</span>)}
              {yeniBildirim.length > 3 && ` · +${yeniBildirim.length - 3} daha`}. Süreçleri gözden geçirip bilgini işaretle.</span>
              <button type="button" className="mk-link" onClick={() => setSekme("yedek")}>Bak →</button>
            </div>)}
          <div className="mk-lyt" style={{ padding: 0 }}>
            <aside className="mk-liste">
              <input className="mk-ara" placeholder="müşteri ara…" value={ara} onChange={(e) => setAra(e.target.value)} />
              <div className="mk-satirlar">
                {benim.length === 0 && <div className="mk-bos">Portföyünde aktif müşteri yok.</div>}
                {benim.filter((c) => !q || c.ad.toLowerCase().includes(q) || c.kod.includes(q)).map((c) => (
                  <div key={c.kod} className={"mk-sat" + (c.kod === secili ? " on" : "")} onClick={() => setSecili(c.kod)} role="button" tabIndex={0}>
                    <div><div className="ad">{c.ad}</div><div className="kod">{c.kod}{c.pay < 99.99 ? ` · %${Math.round(c.pay)} pay` : ""}</div>
                      <div className="tem">{c.notSayisi ? `${c.notSayisi} not` : "notu yok"}{c.yedekler.length ? ` · yedek: ${c.yedekler.map((y) => y.ad.split(" ")[0]).join(", ")}` : " · yedek yok"}</div></div>
                    <div className="roz">
                      {c.dikkat && <span className="r dikkat">!</span>}
                      {c.yedekler.length === 0 ? <span className="r yok">yedek yok</span>
                        : c.notSayisi === 0 ? <span className="r sari">notu yok</span>
                        : hazirRozet(c.yedekler.reduce((en, y) => y.hazirlik.yuzde > en.hazirlik.yuzde ? y : en, c.yedekler[0]).hazirlik)}
                    </div>
                  </div>))}
              </div>
            </aside>
            <section className="mk-detay">
              {!detay && <div className="mk-bos">{secili ? "Yükleniyor…" : "Soldan bir müşteri seç."}</div>}
              {detay && detay.rol === "asil" && (
                <>
                  <div className="mk-bas"><h2>{detay.ad}</h2>
                    <div className="meta"><span className="badge">{detay.kod}</span>
                      <span className="badge">{detay.kanal === 20 ? "Yurtdışı 20" : detay.kanal === 10 ? "Yurtiçi 10" : "kanal —"}</span>
                      {detay.segment && <span className="badge">{detay.segment}</span>}
                      {detay.pay < 99.99 && <span className="badge">%{Math.round(detay.pay)} senin payın · {detay.asil}</span>}</div></div>
                  {detay.izinler.map((z, i) => (
                    <div key={i} className={"mk-izin-serit " + z.durum}>
                      {z.durum === "suruyor" ? <>Şu an izindesin; bu müşteriye <b>{z.bakan ?? "kimse seçilmedi"}</b> bakıyor ({tr(z.baslangic)} – {tr(z.bitis)}).</>
                        : <>{tr(z.baslangic)} – {tr(z.bitis)} izinlisin; bu müşteriye {z.bakan ? <b>{z.bakan}</b> : <b>henüz kimse</b>} bakacak.</>}
                    </div>))}

                  <div className="mk-bolum">
                    <h3>Yedeklerim <span className="aciklama">ben yokken kim bakabilir · sıra önceliktir</span></h3>
                    {detay.yedekler.length === 0 && <div className="mk-bos kucuk">Henüz yedek seçmedin.</div>}
                    <div className="mk-yedekler">
                      {detay.yedekler.map((y, i) => (
                        <div key={y.id} className="mk-yedek">
                          <div className="ust"><span className="no">{i + 1}.</span><b className="ad">{y.ad}</b>
                            <span className="ipucu">{ekipAd(y.ekip)}</span>
                            <span className="islem">
                              <button type="button" className="mk-link" disabled={bekle || i === 0} onClick={() => baslat(async () => uygula(await yedekSiraAction(detay.kod, y.id, "yukari")))}>▲</button>
                              <button type="button" className="mk-link" disabled={bekle || i === detay.yedekler.length - 1} onClick={() => baslat(async () => uygula(await yedekSiraAction(detay.kod, y.id, "asagi")))}>▼</button>
                              <button type="button" className="mk-link sil" disabled={bekle} onClick={() => { if (confirm(y.ad + " yedeklikten çıkarılsın mı?")) baslat(async () => uygula(await yedekSilAction(detay.kod, y.id))); }}>çıkar</button>
                            </span></div>
                          <div className="pm-hazir-satir"><HazirlikCubuk h={y.hazirlik} />
                            <span className="kucuk">{y.hazirlik.toplam ? `${y.hazirlik.tam} tam · ${y.hazirlik.aktarim} aktarım gerekli · ${y.hazirlik.yok} fikri yok${y.hazirlik.bekleyen ? ` · ${y.hazirlik.bekleyen} bekliyor` : ""}` : "not yazınca değerlendirir"}</span></div>
                          {(y.hazirlik.aktarim + y.hazirlik.yok) > 0 && (
                            <div className="pm-aktarim">Aktarım gereken konular: {detay.notlar.filter((x) => x.gecerli && x.degerlendirmeler.some((d) => d.yedek === y.ad && d.durum !== "tam")).map((x) => x.tur).join(", ")}</div>)}
                        </div>))}
                    </div>
                    <div className="mk-yedek-ekle">
                      <select value="" disabled={bekle} onChange={(e) => { const v = Number(e.target.value); if (v) baslat(async () => uygula(await yedekEkleAction(detay.kod, v))); }}>
                        <option value="">+ yedek ekle…</option>
                        {temsilciler.filter((t) => !detay.yedekler.some((y) => y.id === t.id) && !detay.asil.includes(t.ad))
                          .map((t) => <option key={t.id} value={t.id}>{t.ad}{t.ekip ? " · " + ekipAd(t.ekip) : ""}</option>)}
                      </select>
                      <span className="kucuk">Seçtiğin kişi kendi Portföyüm sayfasında "seni yedek belirledi" uyarısı görür ve süreçlerini değerlendirir.</span>
                    </div>
                  </div>

                  <div className="mk-bolum">
                    <h3>Süreçler ve notlar <span className="aciklama">sen yazarsın · yedeklerin okuyup "biliyorum / aktarım lazım / fikrim yok" der</span></h3>
                    {detay.notlar.length === 0 && <div className="mk-bos kucuk">Henüz not yok. Bu müşteriyle nasıl çalışıldığını başlık başlık yaz.</div>}
                    <div className="mk-notlar">
                      {detay.notlar.map((x) => (
                        <div key={x.id} className={"mk-not" + (x.gecerli ? "" : " eski") + (x.onemli && x.gecerli ? " dikkat" : "")}>
                          <div className="nb"><b>{x.tur}{x.izin && <span className="devir"> · devir notu · {x.izin}</span>}{!x.gecerli && <span className="gecersiz"> · geçersiz</span>}</b>
                            <span className="kim">{x.yazan ?? "?"} · {tr(x.ts.slice(0, 10))}</span>
                            {x.gecerli && x.degerlendirmeler.length > 0 && <span className="pm-degs">{x.degerlendirmeler.map((d) => <i key={d.yedek} className={d.durum} title={`${d.yedek}: ${DURUM_AD[d.durum]}`}>{d.yedek.split(" ")[0]}</i>)}</span>}
                            <button type="button" className="mk-link" disabled={bekle} onClick={() => baslat(async () => uygula(await notGecersizAction(detay.kod, x.id, !x.gecerli)))}>{x.gecerli ? "geçersiz yap" : "geri al"}</button>
                          </div>
                          <p>{x.metin}</p>
                        </div>))}
                    </div>
                    <div className="mk-ekle">
                      <div className="satir">
                        <select value={yeniTur} onChange={(e) => setYeniTur(e.target.value)}>
                          <option value="">Başlık seç…</option>
                          {detay.turler.map((t) => <option key={t.id} value={t.id}>{t.onemli ? "⚠ " : ""}{t.ad}</option>)}
                        </select>
                        <textarea value={yeniMetin} onChange={(e) => setYeniMetin(e.target.value)} placeholder="Notu yaz… (Ctrl+Enter kaydeder) — yeni not eklendiğinde yedeklerin bunu yeniden değerlendirir."
                                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) notGonder(); }} />
                      </div>
                      <div className="alt"><button type="button" className="btn primary" disabled={!yeniMetin.trim() || bekle} onClick={notGonder}>{bekle ? "Kaydediliyor…" : "Notu kaydet"}</button></div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ================= YEDEĞİ OLDUĞUM ================= */}
      {sekme === "yedek" && (
        <div className="iz-lyt"><div className="mk-lyt" style={{ padding: 0 }}>
          <aside className="mk-liste">
            <span className="eyebrow">Beni yedek seçenler</span>
            <div className="mk-satirlar">
              {yedek.length === 0 && <div className="mk-bos">Henüz kimse seni yedek seçmedi.</div>}
              {yedek.map((y) => (
                <div key={y.kod} className={"mk-sat" + (y.kod === seciliY ? " on" : "")} onClick={() => setSeciliY(y.kod)} role="button" tabIndex={0}>
                  <div><div className="ad">{y.ad}</div><div className="kod">{y.kod} · {y.asil}</div>
                    <div className="tem">{y.notSayisi} not{y.bakacagim ? ` · ${kisa(y.bakacagim.baslangic)}–${kisa(y.bakacagim.bitis)} sen bakacaksın` : ""}</div></div>
                  <div className="roz">
                    {y.yeni > 0 && y.yeni === y.hazirlik.toplam ? <span className="r kirmizi">yeni · değerlendirilmedi</span>
                      : y.yeni > 0 ? <span className="r sari">%{y.hazirlik.yuzde} · {y.yeni} yeni not</span>
                      : y.notSayisi === 0 ? <span className="r gri">not yok</span>
                      : <span className={"r " + (y.hazirlik.yuzde >= 80 ? "yesil" : "sari")}>%{y.hazirlik.yuzde} hazır</span>}
                  </div>
                </div>))}
            </div>
          </aside>
          <section className="mk-detay">
            {!detay && <div className="mk-bos">{seciliY ? "Yükleniyor…" : "Soldan bir müşteri seç."}</div>}
            {detay && detay.rol === "yedek" && (() => {
              const g = detay.notlar.filter((x) => x.gecerli);
              const say = { tam: g.filter((x) => x.benimDurumum === "tam").length, aktarim: g.filter((x) => x.benimDurumum === "aktarim").length,
                            yok: g.filter((x) => x.benimDurumum === "yok").length, bek: g.filter((x) => !x.benimDurumum).length };
              const benimBakacagim = detay.izinler.find((z) => z.bakan && temsilciler.every((t) => t.ad !== z.bakan)) ?? detay.izinler.find((z) => z.bakan);
              return (
                <>
                  <div className="mk-bas"><h2>{detay.ad}</h2>
                    <div className="meta"><span className="badge">{detay.kod}</span>
                      <span className="badge">{detay.kanal === 20 ? "Yurtdışı 20" : detay.kanal === 10 ? "Yurtiçi 10" : ""}</span>
                      <span className="badge mavi">asıl: {detay.asil}</span></div></div>
                  {detay.izinler.map((z, i) => (
                    <div key={i} className="mk-izin-serit suruyor">📅 {z.temsilci} <b>{tr(z.baslangic)} – {tr(z.bitis)}</b> {z.durum === "suruyor" ? "izinde" : "izinli olacak"}.
                      {z.bakan ? <> Bu müşteriye o tarihlerde <b>{z.bakan}</b> bakacak.</> : <> Bakacak kişi henüz seçilmedi.</>}
                      {(say.aktarim + say.yok) > 0 && <> İzinden önce "aktarım gerekli" dediklerini {z.temsilci.split(" ")[0]} ile konuş.</>}
                    </div>))}
                  {benimBakacagim === undefined && detay.izinler.length === 0 && <div className="kucuk">Henüz planlı izin yok; yine de süreçleri değerlendir, hazır ol.</div>}

                  <div className="pm-ozet">
                    <div><b className="t">{say.tam}</b><span>bilgim tam</span></div>
                    <div><b className="a">{say.aktarim}</b><span>aktarım gerekli</span></div>
                    <div><b className="y">{say.yok}</b><span>hiç fikrim yok</span></div>
                    <div><b className="d">{say.bek}</b><span>değerlendirilmedi</span></div>
                  </div>
                  <div className="kucuk">Her notun altındaki üç seçenekten birini işaretle; {detay.asil.split(" ")[0]} ve yöneticiler bunu görür. Yeni not eklenince burada "YENİ" olarak düşer.</div>

                  <div className="mk-notlar">
                    {g.length === 0 && <div className="mk-bos kucuk">Bu müşteri için henüz süreç notu yazılmamış.</div>}
                    {g.map((x) => (
                      <div key={x.id} className={"mk-not" + (x.onemli ? " dikkat" : "")}>
                        <div className="nb"><b>{x.tur}</b><span className="kim">{x.yazan ?? "?"} · {tr(x.ts.slice(0, 10))}</span></div>
                        <p>{x.metin}</p>
                        <div className="pm-deg">
                          <span className="l">Bu konuda:</span>
                          {(["tam", "aktarim", "yok"] as Durum[]).map((d) => (
                            <button type="button" key={d} disabled={bekle} className={"cip " + d + (x.benimDurumum === d ? " on" : "")}
                                    onClick={() => baslat(async () => uygula(await degerlendirAction(detay.kod, x.id, d)))}>{DURUM_AD[d]}</button>))}
                          {!x.benimDurumum && <span className="yeni">YENİ · değerlendirilmedi</span>}
                        </div>
                      </div>))}
                  </div>
                  <div className="kucuk">Yedek not yazamaz, yalnız değerlendirir.</div>
                </>);
            })()}
          </section>
        </div></div>
      )}

      {/* ================= HATIRLATMALARIM ================= */}
      {sekme === "hat" && (
        <div className="iz-lyt"><div className="iz-kart">
          <span className="eyebrow">Bana düşenler</span>
          {hat.filter((h) => !h.yapildi).length === 0 && <div className="mk-bos">Bekleyen hatırlatma yok.</div>}
          {hat.map((h) => (
            <div key={h.id} className={"ht-sat" + (h.yapildi ? " yapildi" : h.gecikme > 0 ? " gec" : h.gecikme === 0 ? " bugun" : "")} style={{ marginTop: 6 }}>
              <input type="checkbox" checked={h.yapildi} disabled={bekle}
                     onChange={(e) => baslat(async () => { const r = await hatirlatmaYapildiAction(h.id, e.target.checked); if (r.ok) setHat(r.veri); else setMesaj({ tip: "hata", metin: r.hata }); })} />
              <span className="tar">{tr(h.tarih)}</span>
              <span><b>{h.cari_ad}</b> — {h.metin}{h.izin && <span className="kim"> · {h.izin} izninden</span>}</span>
              <span className="sag">{!h.yapildi && h.gecikme > 0 && <span className="r kirmizi">{h.gecikme} gün gecikti</span>}{!h.yapildi && h.gecikme === 0 && <span className="r sari">bugün</span>}</span>
            </div>))}
          <div className="kucuk" style={{ marginTop: 8 }}>Yalnız sana düşen hatırlatmalar. Asıl temsilci ve yöneticiler de görür.</div>
        </div></div>
      )}
    </>
  );
}
