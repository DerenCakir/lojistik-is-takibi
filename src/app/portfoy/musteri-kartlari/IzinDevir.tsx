"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Izin, IzinTur, Tahta } from "@/lib/portfoy-izin";
import type { Temsilci, Tur } from "@/lib/portfoy-kart";
import {
  izinEkleAction, izinIptalAction, tahtaAction, devirAction, otomatikAtaAction,
  devirNotuAction, hatirlatmaEkleAction,
} from "./actions";

type Mesaj = { tip: "ok" | "hata"; metin: string } | null;
const nf = (v: number, d = 1) => v.toLocaleString("tr-TR", { maximumFractionDigits: d });
const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const AYU = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const d10 = (d: Date) => d.toISOString().slice(0, 10);
const tr = (s: string) => { const [y, m, g] = s.split("-"); return `${g}.${m}.${y}`; };
const kisa = (s: string) => { const [, m, g] = s.split("-"); return `${+g} ${AY[+m - 1]}`; };
const ekle = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d10(d); };
const pazartesi = (s: string) => { const d = new Date(s + "T00:00:00Z"); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d10(d); };
const TUR_AD: Record<IzinTur, string> = { izin: "yıllık izin", rapor: "rapor", diger: "diğer" };
const DURUM_AD = { planli: "yaklaşıyor", suruyor: "sürüyor", bitti: "bitti" } as const;

export default function IzinDevir({ ilkIzinler, temsilciler, turler, yazar, mesajVer }: {
  ilkIzinler: Izin[]; temsilciler: Temsilci[]; turler: Tur[]; yazar: boolean; mesajVer: (m: Mesaj) => void;
}) {
  const [izinler, setIzinler] = useState<Izin[]>(ilkIzinler);
  const [secili, setSecili] = useState<number | null>(
    ilkIzinler.find((i) => i.durum === "suruyor")?.id ?? ilkIzinler.find((i) => i.durum === "planli")?.id ?? null);
  const [tahta, setTahta] = useState<Tahta | null>(null);
  const [bekle, baslat] = useTransition();
  const [formAcik, setFormAcik] = useState(false);
  const [herkes, setHerkes] = useState(false);
  const bugun = d10(new Date());
  const [pencere, setPencere] = useState(pazartesi(bugun)); // çizelge başlangıcı (Pazartesi)
  const GUN = 56;

  useEffect(() => {
    if (secili === null) { setTahta(null); return; }
    let iptal = false;
    tahtaAction(secili).then((r) => { if (!iptal) { if (r.ok) setTahta(r.veri); else mesajVer({ tip: "hata", metin: r.hata }); } });
    return () => { iptal = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secili]);

  const sonuc = (r: { ok: true; veri: Tahta | null; mesaj?: string } | { ok: false; hata: string }) => {
    if (!r.ok) { mesajVer({ tip: "hata", metin: r.hata }); return; }
    setTahta(r.veri); if (r.mesaj) mesajVer({ tip: "ok", metin: r.mesaj });
    // izin listesindeki sayaçları tazele
    if (r.veri) setIzinler((L) => L.map((i) => i.id === r.veri!.izin.id ? r.veri!.izin : i));
  };

  /* ---------------- çizelge ---------------- */
  const pencereSon = ekle(pencere, GUN - 1);
  const cizelgeSatirlar = useMemo(() => {
    const kisiIzin = new Map<string, Izin[]>();
    for (const i of izinler) {
      if (i.bitis < pencere || i.baslangic > pencereSon) continue;
      if (!kisiIzin.has(i.temsilci)) kisiIzin.set(i.temsilci, []);
      kisiIzin.get(i.temsilci)!.push(i);
    }
    const adlar = herkes ? temsilciler.map((t) => t.ad) : [...kisiIzin.keys()];
    return adlar.sort((a, b) => a.localeCompare(b, "tr")).map((ad) => ({ ad, izinler: kisiIzin.get(ad) ?? [] }));
  }, [izinler, pencere, pencereSon, herkes, temsilciler]);

  // günlük "kaç kişi yok" → 2+ olan aralıkları çakışma çubuğu yap
  const cakismalar = useMemo(() => {
    const sayim = new Array(GUN).fill(0);
    for (const i of izinler) for (let k = 0; k < GUN; k++) {
      const g = ekle(pencere, k); if (g >= i.baslangic && g <= i.bitis) sayim[k]++;
    }
    const out: { bas: number; bit: number; n: number }[] = [];
    for (let k = 0; k < GUN; k++) {
      if (sayim[k] < 2) continue;
      const son = out[out.length - 1];
      if (son && son.bit === k - 1 && son.n === sayim[k]) son.bit = k; else out.push({ bas: k, bit: k, n: sayim[k] });
    }
    return out;
  }, [izinler, pencere]);

  const kol = (s: string) => Math.max(0, Math.min(GUN, Math.round((new Date(s + "T00:00:00Z").getTime() - new Date(pencere + "T00:00:00Z").getTime()) / 86400000)));
  const aylar = useMemo(() => {
    const out: { ad: string; bas: number; bit: number }[] = [];
    for (let k = 0; k < GUN; k++) {
      const [y, m] = ekle(pencere, k).split("-"); const ad = `${AYU[+m - 1]} ${y}`;
      const son = out[out.length - 1];
      if (son && son.ad === ad) son.bit = k; else out.push({ ad, bas: k, bit: k });
    }
    return out;
  }, [pencere]);

  /* ---------------- izin ekleme formu ---------------- */
  const [fTem, setFTem] = useState(""); const [fBas, setFBas] = useState(bugun);
  const [fBit, setFBit] = useState(bugun); const [fTur, setFTur] = useState<IzinTur>("izin"); const [fAc, setFAc] = useState("");

  const izinKaydet = () => baslat(async () => {
    const r = await izinEkleAction(Number(fTem), fBas, fBit, fTur, fAc.trim() || null);
    if (!r.ok) { mesajVer({ tip: "hata", metin: r.hata }); return; }
    setIzinler(r.veri); mesajVer({ tip: "ok", metin: r.mesaj ?? "" }); setFormAcik(false); setFAc("");
    const yeni = r.veri.find((i) => String(i.temsilci_id) === fTem && i.baslangic === fBas);
    if (yeni) setSecili(yeni.id);
  });

  return (
    <div className="iz-lyt">
      {/* ---------- çizelge ---------- */}
      <div className="iz-kart">
        <div className="iz-bas">
          <span className="eyebrow">İzin çizelgesi · 8 hafta</span>
          <span className="r mavi">■ yıllık izin</span><span className="r sari">■ rapor</span><span className="r gri">■ diğer</span>
          <label className="pf-check kucuk"><input type="checkbox" checked={herkes} onChange={(e) => setHerkes(e.target.checked)} /> herkesi göster</label>
          <span className="iz-gez">
            <button type="button" className="mk-link" onClick={() => setPencere(ekle(pencere, -56))}>‹ önceki 8 hafta</button>
            <button type="button" className="mk-link" onClick={() => setPencere(pazartesi(bugun))}>bugün</button>
            <button type="button" className="mk-link" onClick={() => setPencere(ekle(pencere, 56))}>sonraki 8 hafta ›</button>
          </span>
        </div>
        <div className="cz" style={{ ["--gun" as string]: GUN }}>
          <div /><div className="cz-aylar">{aylar.map((a) => <div key={a.ad} className="ay" style={{ gridColumn: `${a.bas + 1}/${a.bit + 2}` }}>{a.ad}</div>)}</div>
          <div /><div className="cz-gunler">{Array.from({ length: GUN }, (_, k) => {
            const g = ekle(pencere, k); const d = new Date(g + "T00:00:00Z"); const hs = d.getUTCDay() === 0 || d.getUTCDay() === 6;
            return <div key={k} className={"g" + (hs ? " hs" : "") + (g === bugun ? " bugun" : "")} style={{ gridColumn: k + 1 }}>{d.getUTCDay() === 1 || g === bugun ? d.getUTCDate() : ""}</div>; })}</div>
          {cizelgeSatirlar.length === 0 && <><div /><div className="kucuk" style={{ padding: "8px 0" }}>Bu aralıkta izin yok.</div></>}
          {cizelgeSatirlar.map((s) => (
            <div key={s.ad} className="cz-satir-wrap">
              <div className="cz-ad">{s.ad}</div>
              <div className="cz-sat">
                {Array.from({ length: GUN }, (_, k) => { const d = new Date(ekle(pencere, k) + "T00:00:00Z"); return (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? <div key={k} className="hs" style={{ gridColumn: k + 1 }} /> : null; })}
                {bugun >= pencere && bugun <= pencereSon && <div className="bugun-cizgi" style={{ gridColumn: kol(bugun) + 1 }} />}
                {s.izinler.map((i) => {
                  const c1 = kol(i.baslangic < pencere ? pencere : i.baslangic) + 1;
                  const c2 = kol(i.bitis > pencereSon ? pencereSon : i.bitis) + 2;
                  return <button type="button" key={i.id} className={"bar " + i.tur + (i.id === secili ? " on" : "")}
                    style={{ gridColumn: `${c1}/${c2}` }} title={`${i.temsilci} · ${tr(i.baslangic)} – ${tr(i.bitis)} · ${TUR_AD[i.tur]}`}
                    onClick={() => setSecili(i.id)}>{kisa(i.baslangic)}–{kisa(i.bitis)}</button>;
                })}
              </div>
            </div>
          ))}
          {cakismalar.length > 0 && (
            <div className="cz-satir-wrap">
              <div className="cz-ad" style={{ color: "var(--danger, #c0442a)" }}>⚠ çakışma</div>
              <div className="cz-sat">{cakismalar.map((c, i) => <div key={i} className="cak" style={{ gridColumn: `${c.bas + 1}/${c.bit + 2}` }} title={`${c.n} kişi aynı anda yok`}>{c.n} kişi yok</div>)}</div>
            </div>
          )}
        </div>
        <div className="kucuk" style={{ marginTop: 8 }}>Çubuğa tıklayınca altta o iznin devir tahtası açılır.</div>
      </div>

      {/* ---------- izin listesi ---------- */}
      <div className="iz-kart iz-liste">
        <span className="eyebrow">İzinler</span>
        {izinler.filter((i) => i.durum !== "bitti").length === 0 && <span className="kucuk">Planlı ya da süren izin yok.</span>}
        {izinler.filter((i) => i.durum !== "bitti").map((i) => (
          <button type="button" key={i.id} className={"izin" + (i.id === secili ? " on" : "")} onClick={() => setSecili(i.id)}>
            <span><span className="kim">{i.temsilci}</span><span className="tar">{tr(i.baslangic)} – {tr(i.bitis)} · {TUR_AD[i.tur]} · {i.gun} gün</span></span>
            <span className={"r " + (i.durum === "suruyor" ? "yesil" : "sari")}>{DURUM_AD[i.durum]}{i.durum === "planli" ? ` · ${i.kalan} gün` : ""}</span>
          </button>
        ))}
        {izinler.some((i) => i.durum === "bitti") && (
          <details className="iz-bitti"><summary className="kucuk">bitenler · {izinler.filter((i) => i.durum === "bitti").length}</summary>
            {izinler.filter((i) => i.durum === "bitti").map((i) => (
              <button type="button" key={i.id} className={"izin bitti" + (i.id === secili ? " on" : "")} onClick={() => setSecili(i.id)}>
                <span><span className="kim">{i.temsilci}</span><span className="tar">{tr(i.baslangic)} – {tr(i.bitis)}</span></span><span className="r gri">bitti</span>
              </button>))}
          </details>)}
        {yazar && <button type="button" className="btn primary" style={{ marginLeft: "auto" }} onClick={() => setFormAcik((v) => !v)}>{formAcik ? "Vazgeç" : "+ İzin ekle"}</button>}
        {formAcik && yazar && (
          <div className="iz-form">
            <select value={fTem} onChange={(e) => setFTem(e.target.value)}>
              <option value="">Kim izinli?</option>
              {temsilciler.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
            </select>
            <input type="date" value={fBas} onChange={(e) => { setFBas(e.target.value); if (fBit < e.target.value) setFBit(e.target.value); }} />
            <span className="kucuk">→</span>
            <input type="date" value={fBit} min={fBas} onChange={(e) => setFBit(e.target.value)} />
            <select value={fTur} onChange={(e) => setFTur(e.target.value as IzinTur)}>
              <option value="izin">yıllık izin</option><option value="rapor">rapor</option><option value="diger">diğer</option>
            </select>
            <input placeholder="açıklama (isteğe bağlı)" value={fAc} onChange={(e) => setFAc(e.target.value)} />
            <button type="button" className="btn" disabled={!fTem || bekle} onClick={izinKaydet}>Kaydet</button>
          </div>
        )}
      </div>

      {/* ---------- tahta ---------- */}
      {secili !== null && !tahta && <div className="mk-bos">Yükleniyor…</div>}
      {tahta && <TahtaGorunum t={tahta} turler={turler} yazar={yazar} bekle={bekle} baslat={baslat} sonuc={sonuc}
                              mesajVer={mesajVer} iptalEt={() => baslat(async () => {
                                if (!confirm(`${tahta.izin.temsilci} · ${tr(tahta.izin.baslangic)} – ${tr(tahta.izin.bitis)} izni iptal edilsin mi?\nDevir seçimleri silinir; hatırlatmalar ve notlar kalır.`)) return;
                                const r = await izinIptalAction(tahta.izin.id);
                                if (r.ok) { setIzinler(r.veri); setSecili(null); mesajVer({ tip: "ok", metin: r.mesaj ?? "" }); } else mesajVer({ tip: "hata", metin: r.hata });
                              })} />}
    </div>
  );
}

/* ================================ devir tahtası ================================ */
function TahtaGorunum({ t, turler, yazar, bekle, baslat, sonuc, mesajVer, iptalEt }: {
  t: Tahta; turler: Tur[]; yazar: boolean; bekle: boolean;
  baslat: (fn: () => Promise<void>) => void;
  sonuc: (r: { ok: true; veri: Tahta | null; mesaj?: string } | { ok: false; hata: string }) => void;
  mesajVer: (m: Mesaj) => void; iptalEt: () => void;
}) {
  const { izin, satirlar, adaylar } = t;
  const aday = (id: number | null) => adaylar.find((a) => a.id === id);
  const [notAcik, setNotAcik] = useState<string | null>(null);
  const [notTur, setNotTur] = useState(""); const [notMetin, setNotMetin] = useState("");
  const [hatAcik, setHatAcik] = useState<string | null>(null);
  const [hatTarih, setHatTarih] = useState(izin.baslangic); const [hatMetin, setHatMetin] = useState("");
  const secilen = satirlar.filter((s) => s.bakan !== null).length;
  const aktarilan = satirlar.filter((s) => s.aktarildi).length;
  const hatSay = satirlar.reduce((a, s) => a + s.hatirlatmalar.filter((h) => !h.yapildi).length, 0);
  const toplamYuk = satirlar.reduce((a, s) => a + s.yuk, 0);
  const kullanilan = adaylar.filter((a) => a.eklenen > 0);
  const maxPuan = Math.max(100, ...adaylar.map((a) => a.puan + a.eklenenYuk));

  return (
    <div className="iz-tahta-lyt">
      <div className="iz-kart">
        <div className="iz-tahta-bas">
          <div>
            <h2>{izin.temsilci} · {kisa(izin.baslangic)} – {kisa(izin.bitis)} {izin.baslangic.slice(0, 4)}</h2>
            <div className="kucuk">{izin.ekip === "YD" ? "Yurtdışı" : izin.ekip === "YI" ? "Yurtiçi" : ""} · {satirlar.length} müşteri, toplam yük {nf(toplamYuk)} · {TUR_AD[izin.tur]}{izin.aciklama ? ` · ${izin.aciklama}` : ""}</div>
          </div>
          <span className={"r " + (izin.durum === "suruyor" ? "yesil" : izin.durum === "bitti" ? "gri" : "sari")}>{DURUM_AD[izin.durum]}</span>
        </div>
        <div className="iz-arac">
          {yazar && <button type="button" className="btn" disabled={bekle} onClick={() => baslat(async () => sonuc(await otomatikAtaAction(izin.id)))}>Yedeklere otomatik ata</button>}
          {yazar && <button type="button" className="mk-link" onClick={iptalEt}>izni iptal et</button>}
          <span className="iz-ilerleme"><span>bakacak kişi <b>{secilen}/{satirlar.length}</b></span><span>süreç aktarıldı <b>{aktarilan}/{satirlar.length}</b></span><span>bekleyen hatırlatma <b>{hatSay}</b></span></span>
        </div>

        {satirlar.length === 0 && <div className="mk-bos">Bu temsilcinin aktif müşterisi yok.</div>}
        {satirlar.length > 0 && (
          <div className="pf-scroll"><table className="pf-table iz-tablo">
            <thead><tr><th>Müşteri</th><th className="num">Yük</th><th>Yedekleri</th><th style={{ width: 240 }}>Bu izinde kim bakacak</th><th>Süreç aktarımı</th><th>Hatırlatma</th></tr></thead>
            <tbody>
              {satirlar.map((s) => {
                const b = aday(s.bakan);
                const cak = b?.izinde?.cakisma ?? 0;
                const farkliEkip = b && izin.ekip && b.ekip && b.ekip !== izin.ekip;
                return (
                  <tr key={s.kod}>
                    <td><div className="pf-name">{s.ad}</div><div className="pf-sub">{s.kod}{s.pay < 99.99 ? ` · %${Math.round(s.pay)} pay` : ""}</div></td>
                    <td className="num">{nf(s.yuk)}</td>
                    <td className="kucuk">{s.yedekler.length === 0 ? "—" : s.yedekler.map((y, i) => (
                      <div key={y.id} title={y.yetkinlik ?? ""}>{i + 1}. {y.ad}{y.yetkinlik ? <span className="pf-muted"> · {y.yetkinlik.length > 40 ? y.yetkinlik.slice(0, 38) + "…" : y.yetkinlik}</span> : ""}</div>))}</td>
                    <td>
                      <select value={s.bakan ?? ""} disabled={!yazar || bekle}
                              className={cak ? "hata" : (!s.bakan && !s.yedekler.length ? "uyari" : "")}
                              onChange={(e) => baslat(async () => sonuc(await devirAction(izin.id, s.kod, e.target.value ? Number(e.target.value) : null)))}>
                        <option value="">— seçilmedi —</option>
                        {adaylar.map((a) => <option key={a.id} value={a.id}>{a.ad}{a.izinde ? " (izinli!)" : ""}</option>)}
                      </select>
                      <div className={"ipucu" + (cak ? " hata" : farkliEkip || (!s.bakan && !s.yedekler.length) ? " uyari" : "")}>
                        {cak ? `${b!.ad} ${kisa(b!.izinde!.baslangic)}–${kisa(b!.izinde!.bitis)} kendisi de izinli — ${cak} gün çakışıyor.`
                          : b ? `${b.ekip === "YD" ? "Yurtdışı" : b.ekip === "YI" ? "Yurtiçi" : "ekip —"} · puanı ${nf(b.puan)} · bu izinle +${b.eklenen} müşteri${farkliEkip ? " · farklı ekip" : ""}`
                          : !s.yedekler.length ? "Yedeği tanımlı değil. Müşteri kartından yedek ata ya da burada birini seç." : "Henüz seçilmedi."}
                      </div>
                    </td>
                    <td>
                      {s.aktarildi
                        ? <><span className="r yesil">aktarıldı ✓</span><div className="kucuk">{s.aktaranNot!.yazan ?? "?"} · {s.aktaranNot!.ts ? tr(s.aktaranNot!.ts.slice(0, 10)) : ""} · {s.aktaranNot!.adet} not</div></>
                        : <span className="r kirmizi">aktarılmadı</span>}
                      {yazar && <div><button type="button" className="mk-link" style={{ marginLeft: 0 }} onClick={() => { setNotAcik(notAcik === s.kod ? null : s.kod); setNotMetin(""); }}>{s.aktarildi ? "+ not ekle" : "devir notu yaz →"}</button></div>}
                      {notAcik === s.kod && (
                        <div className="iz-mini-form">
                          <select value={notTur} onChange={(e) => setNotTur(e.target.value)}>
                            <option value="">Başlık…</option>
                            {turler.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
                          </select>
                          <textarea value={notMetin} onChange={(e) => setNotMetin(e.target.value)} placeholder="Bu müşteride izin süresince bilinmesi gerekenler…" />
                          <button type="button" className="btn" disabled={!notMetin.trim() || bekle}
                                  onClick={() => baslat(async () => { sonuc(await devirNotuAction(izin.id, s.kod, notTur ? Number(notTur) : null, notMetin)); setNotAcik(null); })}>Kaydet</button>
                        </div>)}
                    </td>
                    <td className="kucuk">
                      {s.hatirlatmalar.map((h) => <div key={h.id} className={h.yapildi ? "pf-muted" : ""}><b>{kisa(h.tarih)}</b> {h.metin}{h.yapildi ? " ✓" : ""}</div>)}
                      {yazar && <button type="button" className="mk-link" style={{ marginLeft: 0 }} onClick={() => { setHatAcik(hatAcik === s.kod ? null : s.kod); setHatMetin(""); }}>+ ekle</button>}
                      {hatAcik === s.kod && (
                        <div className="iz-mini-form">
                          <input type="date" value={hatTarih} onChange={(e) => setHatTarih(e.target.value)} />
                          <input value={hatMetin} onChange={(e) => setHatMetin(e.target.value)} placeholder="ne yapılacak?" />
                          <button type="button" className="btn" disabled={!hatMetin.trim() || bekle}
                                  onClick={() => baslat(async () => {
                                    const r = await hatirlatmaEkleAction(s.kod, hatTarih, hatMetin, izin.id, s.bakan);
                                    if (r.ok) { setHatAcik(null); sonuc(await tahtaAction(izin.id)); mesajVer({ tip: "ok", metin: r.mesaj ?? "" }); } else mesajVer({ tip: "hata", metin: r.hata });
                                  })}>Ekle</button>
                        </div>)}
                    </td>
                  </tr>);
              })}
            </tbody>
          </table></div>
        )}
        <div className="iz-not">Burada yaptıkların <b>ana portala yazılmaz</b>. Puan, atama, dağıtım aynen kalır. İzin bitince kendiliğinden "bitti"ye düşer. Müşteri kartlarında izin süresince şerit çıkar: <i>"Bu müşteriye şu an X bakıyor."</i></div>
      </div>

      {/* ---------- sağ: yük paneli ---------- */}
      <div className="iz-kart iz-yan">
        <h3>Bakacak kişilerin yükü <span className="kucuk">· canlı, ana portaldan</span></h3>
        {kullanilan.length === 0 && <div className="kucuk">Henüz kimse seçilmedi.</div>}
        {kullanilan.sort((a, b) => b.eklenen - a.eklenen).map((a) => (
          <div key={a.id} className={"yk" + (a.izinde ? " kirmizi" : "")}>
            <div className="ad"><span>{a.ad}</span><span>{nf(a.puan)} → +{a.eklenen}</span></div>
            <div className="cubuk"><i style={{ width: `${a.puan / maxPuan * 100}%` }} /><b style={{ width: `${a.eklenenYuk / maxPuan * 100}%` }} /></div>
            <div className="alt">{nf(a.cari_sayisi)} cari · {a.ekip === "YD" ? "Yurtdışı" : a.ekip === "YI" ? "Yurtiçi" : "ekip —"}{a.izinde ? <> · <b style={{ color: "var(--danger, #c0442a)" }}>{kisa(a.izinde.baslangic)}–{kisa(a.izinde.bitis)} kendisi izinli</b></> : ""}</div>
          </div>
        ))}
        <div className="iz-not">Turuncu kısım bu izinle eklenen müşterilerin <b>yaklaşık</b> yükü. Puana yazılmaz; yalnız kararı kolaylaştırmak için.</div>
        {izin.cakisan.length > 0 && <>
          <h3>Aynı tarihlerde izinli</h3>
          {izin.cakisan.map((c, i) => <div key={i} className="yk"><div className="ad"><span>{c.temsilci}</span></div><div className="alt">{kisa(c.baslangic)}–{kisa(c.bitis)} · {c.gun} gün çakışma</div></div>)}
        </>}
      </div>
    </div>
  );
}
