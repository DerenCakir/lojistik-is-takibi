"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Excel sürükle-bırak + önizleme + uygulama.
 *
 * Dosya tarayıcıda okunur (SheetJS, CDN'den yüklenir), sunucuya yalnız
 * satırlar gider. Karşılaştırma ve yazma sunucuda yapılır — buradan gelen
 * hiçbir şeye güvenilmez.
 */

type HamSatir = { cari: string; teslim: string; ad: string; kanal: unknown; sevkiyat: unknown; malzeme: unknown };

/* Sutun eslemesi: once baslik adindan aranir, bulunamazsa sabit siraya dusulur.
   Sessiz kayma en tehlikeli hata turu — esleme ekranda gosterilir. */
const ALANLAR = [
  { ad: "cari",     baslik: "Müşteri Ana Cari",        anahtar: ["ana cari"],            sira: 0, zorunlu: true },
  { ad: "teslim",   baslik: "Malı Teslim Alan",        anahtar: ["teslim alan"],         sira: 1, zorunlu: true },
  { ad: "musteri",  baslik: "Müşteri Adı",             anahtar: ["müşteri adı", "adı"],  sira: 2, zorunlu: false },
  { ad: "kanal",    baslik: "Dağıtım Kanalı",          anahtar: ["kanal"],               sira: 3, zorunlu: false },
  { ad: "sevkiyat", baslik: "Yapılan Sevkiyat Sayısı", anahtar: ["sevkiyat"],            sira: 4, zorunlu: true },
  { ad: "malzeme",  baslik: "Giden malzeme sayısı",    anahtar: ["malzeme"],             sira: 5, zorunlu: true },
] as const;

type Esleme = { ad: string; baslik: string; sutun: number; kaynak: "başlık" | "sıra" };

function sutunlariEsle(basliklar: string[]): { esleme: Esleme[]; hata: string | null } {
  const kucuk = basliklar.map((b) => String(b ?? "").toLocaleLowerCase("tr").trim());
  const esleme: Esleme[] = [];
  const kullanilan = new Set<number>();

  for (const a of ALANLAR) {
    let i = kucuk.findIndex((b, j) =>
      !kullanilan.has(j) && a.anahtar.some((k) => b.includes(k)));
    let kaynak: "başlık" | "sıra" = "başlık";
    if (i < 0) { i = a.sira; kaynak = "sıra"; }
    if (i >= basliklar.length || kullanilan.has(i)) {
      if (a.zorunlu) return { esleme, hata: `"${a.baslik}" sütunu bulunamadı.` };
      continue;
    }
    kullanilan.add(i);
    esleme.push({ ad: a.ad, baslik: basliklar[i] || `${i + 1}. sütun`, sutun: i, kaynak });
  }

  // Sessiz kaymaya karsi son kontrol: sayi bekledigim sutun "kanal" olmasin.
  for (const ad of ["sevkiyat", "malzeme"]) {
    const e = esleme.find((x) => x.ad === ad);
    if (!e) return { esleme, hata: `"${ad}" sütunu bulunamadı.` };
    if (kucuk[e.sutun]?.includes("kanal")) {
      return { esleme, hata:
        `Sütunlar kaymış görünüyor: ${ad} olarak "${basliklar[e.sutun]}" okunuyor. ` +
        `Beklenen sıra: Müşteri Ana Cari · Malı Teslim Alan · Müşteri Adı · Dağıtım Kanalı · ` +
        `Yapılan Sevkiyat Sayısı · Giden malzeme sayısı` };
    }
  }
  return { esleme, hata: null };
}

type Nokta = { cari_kod: string; cari_ad: string; kod: string; ad: string; sevkiyat: number; malzeme: number };
type YeniCari = { kod: string; ad: string; nokta: number; sevkiyat: number; malzeme: number; kanal: number | null; oneri: boolean; sebep: string | null };

type Karsilastirma = {
  ozet: Record<"cari" | "nokta" | "sevkiyat" | "malzeme", { once: number; dosya: number }>;
  yeniCari: YeniCari[];
  yeniNokta: Nokta[];
  kaybolanNokta: Nokta[];
  kaybolanCari: { kod: string; ad: string; nokta: number }[];
  degisen: { kod: string; ad: string; once: number; sonra: number; fark: number }[];
  atlanan: { deger: string; sebep: string }[];
  uyarilar: string[];
};

const ni = (n: number) => Math.round(n).toLocaleString("tr-TR");
const fark = (a: number, b: number) => (b - a >= 0 ? "+" : "") + ni(b - a);

// SheetJS'i bir kez yükler (portalın da kullandığı sürüm).
let sheetJs: Promise<unknown> | null = null;
function sheetYukle() {
  if (sheetJs) return sheetJs;
  sheetJs = new Promise((coz, hata) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => coz(true);
    s.onerror = () => hata(new Error("Excel okuyucu yüklenemedi (internet erişimi?)"));
    document.head.appendChild(s);
  });
  return sheetJs;
}

export default function Yukleyici() {
  const [durum, setDurum] = useState<"bos" | "okunuyor" | "onizleme" | "uygulaniyor" | "bitti">("bos");
  const [hata, setHata] = useState<string | null>(null);
  const [dosyaAdi, setDosyaAdi] = useState("");
  const [satirlar, setSatirlar] = useState<HamSatir[]>([]);
  const [k, setK] = useState<Karsilastirma | null>(null);
  const [sonuc, setSonuc] = useState<{ yuklemeId: number; sayac: Record<string, number> } | null>(null);
  const [uzerinde, setUzerinde] = useState(false);
  const [esleme, setEsleme] = useState<Esleme[]>([]);

  // kullanıcı kararları
  const [secilenCari, setSecilenCari] = useState<Record<string, boolean>>({});
  const [kanal, setKanal] = useState<Record<string, number>>({});
  const [secilenNokta, setSecilenNokta] = useState<Record<string, boolean>>({});
  const [kaldirilacak, setKaldirilacak] = useState<Record<string, boolean>>({});
  const girdi = useRef<HTMLInputElement>(null);

  const sifirla = () => {
    setDurum("bos"); setHata(null); setK(null); setSatirlar([]); setSonuc(null);
    setSecilenCari({}); setKanal({}); setSecilenNokta({}); setKaldirilacak({});
  };

  const dosyaAl = useCallback(async (f: File) => {
    setHata(null); setDosyaAdi(f.name); setDurum("okunuyor");
    try {
      if (!/\.xlsx?$|\.xlsm$/i.test(f.name)) {
        throw new Error("Yalnız .xlsx ve .xlsm dosyalar okunur. Excel'de 'Farklı kaydet' ile çevirin.");
      }
      await sheetYukle();
      const XLSX = (window as unknown as { XLSX: {
        read: (d: ArrayBuffer, o: object) => { SheetNames: string[]; Sheets: Record<string, object> };
        utils: { sheet_to_json: (s: object, o: object) => unknown[][] };
      } }).XLSX;

      const kitap = XLSX.read(await f.arrayBuffer(), { type: "array" });
      // Sütunlar konuma göre okunur; "Malı Teslim Alan" başlığını taşıyan sayfa seçilir.
      let sayfa = kitap.SheetNames[0];
      for (const ad of kitap.SheetNames) {
        const ilk = (XLSX.utils.sheet_to_json(kitap.Sheets[ad], { header: 1, range: 0 })[0] ?? []) as unknown[];
        const basliklar = ilk.map((x) => String(x ?? "").toLocaleLowerCase("tr").trim());
        if (basliklar.some((b) => b.includes("teslim alan"))) { sayfa = ad; break; }
      }
      const tablo = XLSX.utils.sheet_to_json(kitap.Sheets[sayfa], { header: 1 }) as unknown[][];
      if (tablo.length < 2) throw new Error("Sayfada veri satırı yok.");

      const basliklar = (tablo[0] ?? []).map((x) => String(x ?? "").trim());
      const { esleme, hata: eslemeHatasi } = sutunlariEsle(basliklar);
      if (eslemeHatasi) {
        throw new Error(eslemeHatasi + `  Dosyadaki başlıklar: ${basliklar.slice(0, 8).join(" | ")}`);
      }
      setEsleme(esleme);
      const su = (ad: string) => esleme.find((e) => e.ad === ad)?.sutun ?? -1;
      const iC = su("cari"), iT = su("teslim"), iM = su("musteri"),
            iK = su("kanal"), iS = su("sevkiyat"), iG = su("malzeme");

      const s: HamSatir[] = [];
      for (const r of tablo.slice(1)) {
        if (!r || r[iC] === undefined || r[iC] === null || String(r[iC]).trim() === "") continue;
        s.push({ cari: String(r[iC]), teslim: String(r[iT] ?? ""),
                 ad: iM >= 0 ? String(r[iM] ?? "") : "",
                 kanal: iK >= 0 ? r[iK] : null, sevkiyat: r[iS], malzeme: r[iG] });
      }
      if (!s.length) throw new Error("Okunabilir satır bulunamadı.");
      setSatirlar(s);

      const cevap = await fetch("/api/portfoy/yukleme", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ islem: "karsilastir", satirlar: s }),
      });
      const d = await cevap.json();
      if (!cevap.ok) throw new Error(d.hata ?? "Karşılaştırma başarısız.");

      setK(d);
      setSecilenCari(Object.fromEntries(d.yeniCari.map((c: YeniCari) => [c.kod, c.oneri])));
      // Kanal dosyadan gelir; kullanici gerekirse degistirir.
      setKanal(Object.fromEntries(
        d.yeniCari.filter((c: YeniCari) => c.kanal).map((c: YeniCari) => [c.kod, c.kanal as number])));
      setSecilenNokta(Object.fromEntries(d.yeniNokta.map((n: Nokta) => [`${n.cari_kod}|${n.kod}`, true])));
      setKaldirilacak({});
      setDurum("onizleme");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Dosya okunamadı.");
      setDurum("bos");
    }
  }, []);

  async function uygulaTikla() {
    if (!k) return;
    const eklenecekCari = Object.entries(secilenCari)
      .filter(([, v]) => v)
      .map(([kod]) => ({ kod, kanal: kanal[kod] ?? null }));
    const kanalsiz = eklenecekCari.filter((c) => c.kanal === null);
    if (kanalsiz.length) {
      setHata(`Eklenecek ${kanalsiz.length} müşteri için Yurtiçi/Yurtdışı seçilmeli.`);
      return;
    }
    setDurum("uygulaniyor"); setHata(null);
    try {
      const cevap = await fetch("/api/portfoy/yukleme", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          islem: "uygula", satirlar,
          kararlar: {
            eklenecekCari,
            eklenecekNokta: Object.entries(secilenNokta).filter(([, v]) => v).map(([a]) => a),
            kaldirilacakNokta: Object.entries(kaldirilacak).filter(([, v]) => v).map(([a]) => a),
            hacimGuncelle: true,
          },
        }),
      });
      const d = await cevap.json();
      if (!cevap.ok) throw new Error(d.hata ?? "Uygulanamadı.");
      setSonuc(d); setDurum("bitti");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Uygulanamadı.");
      setDurum("onizleme");
    }
  }

  async function geriAlTikla() {
    if (!sonuc) return;
    if (!confirm("Bu yükleme geri alınacak, hacim verisi önceki hâline dönecek. Emin misiniz?")) return;
    const cevap = await fetch("/api/portfoy/yukleme", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ islem: "geri_al", yuklemeId: sonuc.yuklemeId }),
    });
    const d = await cevap.json();
    if (!cevap.ok) { setHata(d.hata ?? "Geri alınamadı."); return; }
    sifirla();
  }

  // ---------------------------------------------------------------- görünüm

  if (durum === "bitti" && sonuc) {
    return (
      <div className="vy-kart">
        <div className="vy-basarili">Yükleme tamamlandı</div>
        <table className="vy-ozet">
          <tbody>
            <tr><td>Eklenen müşteri</td><td>{ni(sonuc.sayac.yeniCari)}</td></tr>
            <tr><td>Eklenen teslim noktası</td><td>{ni(sonuc.sayac.yeniNokta)}</td></tr>
            <tr><td>Güncellenen nokta</td><td>{ni(sonuc.sayac.guncellenen)}</td></tr>
            <tr><td>Kaldırılan nokta</td><td>{ni(sonuc.sayac.kaldirilan)}</td></tr>
            <tr><td>Değeri korunan (#N/A)</td><td>{ni(sonuc.sayac.atlanan)}</td></tr>
          </tbody>
        </table>
        <div className="vy-dugmeler">
          <button className="btn" onClick={sifirla}>Yeni dosya yükle</button>
          <button className="btn ghost" onClick={geriAlTikla}>Bu yüklemeyi geri al</button>
        </div>
      </div>
    );
  }

  // "uygulaniyor" sirasinda da onizleme ekranda kalir; yoksa dugmeye basinca bos ekran gorunur.
  if ((durum === "onizleme" || durum === "uygulaniyor") && k) {
    const o = k.ozet;
    return (
      <div className="vy-kart">
        <div className="vy-dosya">{dosyaAdi} · {ni(satirlar.length)} satır okundu</div>

        <details className="vy-esleme">
          <summary>Sütun eşleşmesi — kontrol edin</summary>
          <table className="vy-tablo">
            <thead><tr><th>Alan</th><th>Dosyadaki başlık</th><th>Sütun</th><th>Nasıl bulundu</th></tr></thead>
            <tbody>
              {esleme.map((e) => (
                <tr key={e.ad}>
                  <td>{ALANLAR.find((a) => a.ad === e.ad)?.baslik}</td>
                  <td>{e.baslik}</td>
                  <td className="num">{e.sutun + 1}</td>
                  <td className={e.kaynak === "sıra" ? "kirmizi" : ""}>{e.kaynak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {k.uyarilar.map((u, i) => (
          <div key={i} className={u.startsWith("DİKKAT") ? "vy-uyari kirmizi" : "vy-uyari"}>{u}</div>
        ))}
        {hata && <div className="vy-uyari kirmizi">{hata}</div>}

        <table className="vy-ozet">
          <thead><tr><th /><th>Şu an</th><th>Dosyada</th><th>Fark</th></tr></thead>
          <tbody>
            <tr><td>Müşteri</td><td>{ni(o.cari.once)}</td><td>{ni(o.cari.dosya)}</td><td>{fark(o.cari.once, o.cari.dosya)}</td></tr>
            <tr><td>Malı teslim alan</td><td>{ni(o.nokta.once)}</td><td>{ni(o.nokta.dosya)}</td><td>{fark(o.nokta.once, o.nokta.dosya)}</td></tr>
            <tr><td>Toplam sevkiyat</td><td>{ni(o.sevkiyat.once)}</td><td>{ni(o.sevkiyat.dosya)}</td><td>{fark(o.sevkiyat.once, o.sevkiyat.dosya)}</td></tr>
            <tr><td>Malzeme kodu</td><td>{ni(o.malzeme.once)}</td><td>{ni(o.malzeme.dosya)}</td><td>{fark(o.malzeme.once, o.malzeme.dosya)}</td></tr>
          </tbody>
        </table>

        {k.yeniCari.length > 0 && (
          <section className="vy-bolum">
            <h4>Yeni müşteriler <span>{k.yeniCari.length}</span></h4>
            <p className="vy-aciklama">
              İşaretlediklerin eklenir. Eklenenler temsilcisiz gelir; dağıtım
              ekranından sahiplendirmen gerekir.
            </p>
            <table className="vy-tablo">
              <thead><tr><th /><th>Kod</th><th>Ad</th><th>Nokta</th><th>Sevkiyat</th><th>Kanal</th></tr></thead>
              <tbody>
                {k.yeniCari.map((c) => (
                  <tr key={c.kod} className={c.sebep ? "vy-supheli" : ""}>
                    <td><input type="checkbox" checked={!!secilenCari[c.kod]}
                      onChange={(e) => setSecilenCari((s) => ({ ...s, [c.kod]: e.target.checked }))} /></td>
                    <td className="vy-kod">{c.kod}</td>
                    <td>{c.ad}{c.sebep && <span className="vy-etiket">{c.sebep}</span>}</td>
                    <td className="num">{ni(c.nokta)}</td>
                    <td className="num">{ni(c.sevkiyat)}</td>
                    <td>
                      <select value={kanal[c.kod] ?? ""} disabled={!secilenCari[c.kod]}
                        onChange={(e) => setKanal((s) => ({ ...s, [c.kod]: Number(e.target.value) }))}>
                        <option value="">— seç —</option>
                        <option value="10">Yurtiçi</option>
                        <option value="20">Yurtdışı</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {k.yeniNokta.length > 0 && (
          <section className="vy-bolum">
            <h4>Yeni malı teslim alanlar <span>{k.yeniNokta.length}</span></h4>
            <table className="vy-tablo">
              <thead><tr><th /><th>Müşteri</th><th>Teslim alan</th><th>Sevkiyat</th></tr></thead>
              <tbody>
                {k.yeniNokta.map((n) => {
                  const a = `${n.cari_kod}|${n.kod}`;
                  return (
                    <tr key={a}>
                      <td><input type="checkbox" checked={!!secilenNokta[a]}
                        onChange={(e) => setSecilenNokta((s) => ({ ...s, [a]: e.target.checked }))} /></td>
                      <td>{n.cari_ad} <span className="vy-kod">{n.cari_kod}</span></td>
                      <td>{n.ad} <span className="vy-kod">{n.kod}</span></td>
                      <td className="num">{ni(n.sevkiyat)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {k.kaybolanNokta.length > 0 && (
          <section className="vy-bolum">
            <h4>Dosyada olmayan teslim noktaları <span>{k.kaybolanNokta.length}</span></h4>
            <p className="vy-aciklama">
              Bunlar <b>silinmez</b>. Gerçekten kapandığından eminsen işaretle.
            </p>
            <table className="vy-tablo">
              <thead><tr><th /><th>Müşteri</th><th>Teslim alan</th><th>Mevcut sevkiyat</th></tr></thead>
              <tbody>
                {k.kaybolanNokta.map((n) => {
                  const a = `${n.cari_kod}|${n.kod}`;
                  return (
                    <tr key={a}>
                      <td><input type="checkbox" checked={!!kaldirilacak[a]}
                        onChange={(e) => setKaldirilacak((s) => ({ ...s, [a]: e.target.checked }))} /></td>
                      <td>{n.cari_ad} <span className="vy-kod">{n.cari_kod}</span></td>
                      <td>{n.ad} <span className="vy-kod">{n.kod}</span></td>
                      <td className="num">{ni(n.sevkiyat)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {k.kaybolanCari.length > 0 && (
          <section className="vy-bolum">
            <h4 className="kirmizi">Dosyada hiç olmayan müşteriler <span>{k.kaybolanCari.length}</span></h4>
            <p className="vy-aciklama">
              Bunlara dokunulmayacak. Kümülatif veride bir müşterinin tamamen
              kaybolması beklenmez — dosyayı kontrol et.
            </p>
            <table className="vy-tablo">
              <thead><tr><th>Kod</th><th>Ad</th><th>Nokta</th></tr></thead>
              <tbody>
                {k.kaybolanCari.slice(0, 30).map((c) => (
                  <tr key={c.kod}><td className="vy-kod">{c.kod}</td><td>{c.ad}</td><td className="num">{c.nokta}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {k.degisen.length > 0 && (
          <section className="vy-bolum">
            <h4>En çok değişen müşteriler</h4>
            <table className="vy-tablo">
              <thead><tr><th>Müşteri</th><th>Önce</th><th>Sonra</th><th>Fark</th></tr></thead>
              <tbody>
                {k.degisen.map((d) => (
                  <tr key={d.kod}>
                    <td>{d.ad} <span className="vy-kod">{d.kod}</span></td>
                    <td className="num">{ni(d.once)}</td>
                    <td className="num">{ni(d.sonra)}</td>
                    <td className={"num " + (d.fark < 0 ? "kirmizi" : "")}>{d.fark > 0 ? "+" : ""}{ni(d.fark)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className="vy-dugmeler">
          <button className="btn" onClick={uygulaTikla} disabled={durum === "uygulaniyor"}>
            {durum === "uygulaniyor" ? "Uygulanıyor…" : "Uygula"}
          </button>
          <button className="btn ghost" onClick={sifirla}>Vazgeç</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={"vy-birak" + (uzerinde ? " uzerinde" : "")}
      onDragOver={(e) => { e.preventDefault(); setUzerinde(true); }}
      onDragLeave={() => setUzerinde(false)}
      onDrop={(e) => {
        e.preventDefault(); setUzerinde(false);
        const f = e.dataTransfer.files?.[0];
        if (f) dosyaAl(f);
      }}
      onClick={() => girdi.current?.click()}
    >
      <input ref={girdi} type="file" accept=".xlsx,.xlsm" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) dosyaAl(f); }} />
      <div className="vy-ikon">＋</div>
      <div className="vy-baslik">
        {durum === "okunuyor" ? "Dosya okunuyor…" : "Excel dosyasını buraya sürükleyin"}
      </div>
      <div className="vy-alt">veya tıklayıp seçin · .xlsx</div>
      {hata && <div className="vy-uyari kirmizi" onClick={(e) => e.stopPropagation()}>{hata}</div>}
    </div>
  );
}
