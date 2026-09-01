import "server-only";
import { db } from "./db";

/**
 * Excel'den gelen hacim verisini mevcut veriyle karşılaştırır.
 *
 * Hiçbir şey yazılmaz — yalnız fark çıkarılır. Yazma işlemi kullanıcı
 * önizlemeyi onayladıktan sonra ayrı bir adımda yapılır.
 *
 * Beklenen sütun sırası (konuma göre okunur):
 *   1 Müşteri Ana Cari · 2 Malı Teslim Alan · 3 Müşteri Adı
 *   4 Dağıtım Kanalı · 5 Yapılan Sevkiyat Sayısı · 6 Giden malzeme sayısı
 */

export type HamSatir = {
  cari: string; teslim: string; ad: string;
  kanal?: unknown; sevkiyat: unknown; malzeme: unknown;
};

export type Nokta = {
  cari_kod: string; cari_ad: string; kod: string; ad: string;
  sevkiyat: number; malzeme: number;
};

export type YeniCari = {
  kod: string; ad: string; nokta: number; sevkiyat: number; malzeme: number;
  kanal: number | null;          // dosyadan gelir, ekranda değiştirilebilir
  oneri: boolean; sebep: string | null;
};

export type Karsilastirma = {
  ozet: {
    cari: { once: number; dosya: number };
    nokta: { once: number; dosya: number };
    sevkiyat: { once: number; dosya: number };
    malzeme: { once: number; dosya: number };
  };
  yeniCari: YeniCari[];
  yeniNokta: Nokta[];
  kaybolanNokta: Nokta[];
  kaybolanCari: { kod: string; ad: string; nokta: number }[];
  degisen: { kod: string; ad: string; once: number; sonra: number; fark: number }[];
  atlanan: { deger: string; sebep: string }[];
  uyarilar: string[];
};

/** Excel hücresi -> cari/teslim kodu. Sayı, metin ve 7001.0 farkını siler. */
export function kodNormalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v).trim();
  if (/^\d+\.0+$/.test(s)) s = s.slice(0, s.indexOf("."));
  return s.replace(/\s+/g, "");
}

/** #N/A, boş ve metin -> null (bilinmiyor); sayı -> sayı. */
export function sayiVeyaNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^#/.test(s)) return null;                    // #N/A, #YOK, #DEĞER!
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Deneme kaydı kalıbı — listede görünür ama işaretsiz gelir. */
const DENEME = /(ZDUMMY|ZKANBAN|MSZKANBAN|DUMMY|TEST)/i;

export async function karsilastir(satirlar: HamSatir[]): Promise<Karsilastirma> {
  const atlanan: { deger: string; sebep: string }[] = [];
  const uyarilar: string[] = [];

  // ---------- dosyayı topla ----------
  type DosyaNokta = { sevkiyat: number | null; malzeme: number | null; ad: string };
  const dosyaNokta = new Map<string, DosyaNokta>();          // "cari|teslim"
  const dosyaCari = new Map<string, { ad: string; nokta: number; sevkiyat: number; malzeme: number; kanal: number | null }>();
  let naSayisi = 0;

  for (const r of satirlar) {
    const cari = kodNormalize(r.cari);
    const teslim = kodNormalize(r.teslim);
    if (!cari) continue;
    if (!/^\d+$/.test(cari)) { atlanan.push({ deger: cari, sebep: "cari kodu sayı değil" }); continue; }
    if (!teslim) { atlanan.push({ deger: cari, sebep: "malı teslim alan boş" }); continue; }

    const sv = sayiVeyaNull(r.sevkiyat);
    const gm = sayiVeyaNull(r.malzeme);
    if (sv === null || gm === null) naSayisi++;

    dosyaNokta.set(`${cari}|${teslim}`, { sevkiyat: sv, malzeme: gm, ad: String(r.ad ?? "").trim() });
    const c = dosyaCari.get(cari) ?? { ad: "", nokta: 0, sevkiyat: 0, malzeme: 0, kanal: null };
    if (!c.ad) c.ad = String(r.ad ?? "").trim();
    if (c.kanal === null) {
      const kn = sayiVeyaNull(r.kanal);
      if (kn === 10 || kn === 20) c.kanal = kn;
    }
    c.nokta++; c.sevkiyat += sv ?? 0; c.malzeme += gm ?? 0;
    dosyaCari.set(cari, c);
  }

  // ---------- mevcut veri ----------
  const mevcutCari = await db.$queryRaw<{ kod: string; ad: string; kanal: number | null }[]>`
    select kod, ad, kanal from portfoy.cari`;
  const mevcutNokta = await db.$queryRaw<
    { cari_kod: string; kod: string; ad: string; sevkiyat: number; malzeme_kodu: number }[]
  >`select cari_kod, kod, ad, sevkiyat, malzeme_kodu from portfoy.teslim_noktasi`;

  const cariAd = new Map(mevcutCari.map((c) => [c.kod, c.ad]));
  const noktaMap = new Map(mevcutNokta.map((n) => [`${n.cari_kod}|${n.kod}`, n]));
  const noktaSayisi = new Map<string, number>();
  for (const n of mevcutNokta) noktaSayisi.set(n.cari_kod, (noktaSayisi.get(n.cari_kod) ?? 0) + 1);

  // ---------- dört kova ----------
  const yeniCari: YeniCari[] = [];
  for (const [kod, d] of dosyaCari) {
    if (cariAd.has(kod)) continue;
    const deneme = DENEME.test(d.ad) || DENEME.test(kod);
    const hareketsiz = d.sevkiyat === 0;
    yeniCari.push({
      kod, ad: d.ad || "(adsız)", nokta: d.nokta, sevkiyat: d.sevkiyat, malzeme: d.malzeme,
      kanal: d.kanal,
      oneri: !deneme && !hareketsiz,
      sebep: deneme ? "deneme kaydı olabilir" : hareketsiz ? "sevkiyatı yok" : null,
    });
  }
  yeniCari.sort((a, b) => b.sevkiyat - a.sevkiyat);

  const yeniNokta: Nokta[] = [];
  const degisen: Karsilastirma["degisen"] = [];
  for (const [anahtar, d] of dosyaNokta) {
    const [cari_kod, kod] = anahtar.split("|");
    const eski = noktaMap.get(anahtar);
    if (!eski) {
      if (cariAd.has(cari_kod)) {   // cari var, nokta yeni
        yeniNokta.push({
          cari_kod, cari_ad: cariAd.get(cari_kod) ?? "", kod, ad: d.ad,
          sevkiyat: d.sevkiyat ?? 0, malzeme: d.malzeme ?? 0,
        });
      }
      continue;
    }
    if (d.sevkiyat !== null && d.sevkiyat !== Number(eski.sevkiyat)) {
      degisen.push({
        kod: cari_kod, ad: cariAd.get(cari_kod) ?? "",
        once: Number(eski.sevkiyat), sonra: d.sevkiyat,
        fark: d.sevkiyat - Number(eski.sevkiyat),
      });
    }
  }
  degisen.sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark));

  const kaybolanNokta: Nokta[] = [];
  for (const n of mevcutNokta) {
    if (dosyaNokta.has(`${n.cari_kod}|${n.kod}`)) continue;
    kaybolanNokta.push({
      cari_kod: n.cari_kod, cari_ad: cariAd.get(n.cari_kod) ?? "",
      kod: n.kod, ad: n.ad, sevkiyat: Number(n.sevkiyat), malzeme: Number(n.malzeme_kodu),
    });
  }

  const kaybolanCari: { kod: string; ad: string; nokta: number }[] = [];
  for (const c of mevcutCari) {
    if (dosyaCari.has(c.kod)) continue;
    kaybolanCari.push({ kod: c.kod, ad: c.ad, nokta: noktaSayisi.get(c.kod) ?? 0 });
  }

  // ---------- özet ve uyarılar ----------
  const dosyaSevkiyat = [...dosyaCari.values()].reduce((a, c) => a + c.sevkiyat, 0);
  const dosyaMalzeme = [...dosyaCari.values()].reduce((a, c) => a + c.malzeme, 0);
  const oncekiSevkiyat = mevcutNokta.reduce((a, n) => a + Number(n.sevkiyat), 0);
  const oncekiMalzeme = mevcutNokta.reduce((a, n) => a + Number(n.malzeme_kodu), 0);

  if (naSayisi) {
    uyarilar.push(
      `${naSayisi} satırda sevkiyat veya malzeme sayısı okunamadı (#N/A). ` +
      `Bu satırlarda mevcut değer korunacak, sıfırlanmayacak.`);
  }
  if (dosyaSevkiyat < oncekiSevkiyat) {
    const dusus = Math.round((1 - dosyaSevkiyat / (oncekiSevkiyat || 1)) * 100);
    uyarilar.push(
      `DİKKAT: Toplam sevkiyat ${oncekiSevkiyat.toLocaleString("tr-TR")} → ` +
      `${dosyaSevkiyat.toLocaleString("tr-TR")} (%${dusus} düşüş). Veri yıl başından beri ` +
      `kümülatif olmalı; azalıyorsa ya yeni yıl başladı ya yanlış dosya yüklendi.`);
  }
  if (kaybolanCari.length) {
    uyarilar.push(
      `${kaybolanCari.length} cari dosyada hiç yok. Silinmeyecek; onaylamazsan ` +
      `mevcut hâliyle kalacak.`);
  }
  if (dosyaCari.size < mevcutCari.length * 0.5) {
    uyarilar.push(
      `DİKKAT: Dosyada ${dosyaCari.size} cari var, portalda ${mevcutCari.length}. ` +
      `Eksik veya yanlış dosya olabilir.`);
  }

  return {
    ozet: {
      cari: { once: mevcutCari.length, dosya: dosyaCari.size },
      nokta: { once: mevcutNokta.length, dosya: dosyaNokta.size },
      sevkiyat: { once: oncekiSevkiyat, dosya: dosyaSevkiyat },
      malzeme: { once: oncekiMalzeme, dosya: dosyaMalzeme },
    },
    yeniCari, yeniNokta, kaybolanNokta, kaybolanCari,
    degisen: degisen.slice(0, 25),
    atlanan, uyarilar,
  };
}

/* =====================================================================
   UYGULAMA
   Önizleme onaylandıktan sonra çalışır. Önce mevcut hacim verisinin tam
   kopyası alınır (geri alma için), sonra tek transaction'da yazılır.
   ===================================================================== */

export type Kararlar = {
  eklenecekCari: { kod: string; kanal: number | null }[];
  eklenecekNokta: string[];      // "cari|teslim"
  kaldirilacakNokta: string[];   // "cari|teslim"
  hacimGuncelle: boolean;
};

/** Yükleme geçmişi tablosu — ilk kullanımda kendiliğinden oluşur. */
async function tabloHazirla(tx: { $executeRawUnsafe: (q: string) => Promise<unknown> }) {
  await tx.$executeRawUnsafe(`
    create table if not exists portfoy.yukleme (
      id          bigserial primary key,
      ts          timestamptz not null default now(),
      kullanici   text,
      ozet        jsonb,
      yedek       jsonb,
      geri_alindi boolean not null default false
    )`);
}

export async function uygula(
  satirlar: HamSatir[], kararlar: Kararlar, kullanici: string,
): Promise<{ yuklemeId: number; sayac: Record<string, number> }> {
  const sayac = { yeniCari: 0, yeniNokta: 0, guncellenen: 0, kaldirilan: 0, atlanan: 0 };

  // dosyayı indeksle
  const dosya = new Map<string, { sevkiyat: number | null; malzeme: number | null; ad: string; kanal: number | null }>();
  for (const r of satirlar) {
    const cari = kodNormalize(r.cari), teslim = kodNormalize(r.teslim);
    if (!cari || !teslim || !/^\d+$/.test(cari)) continue;
    const kn = sayiVeyaNull(r.kanal);
    dosya.set(`${cari}|${teslim}`, {
      sevkiyat: sayiVeyaNull(r.sevkiyat), malzeme: sayiVeyaNull(r.malzeme),
      ad: String(r.ad ?? "").trim(), kanal: kn === 10 || kn === 20 ? kn : null,
    });
  }

  let yuklemeId = 0;
  await db.$transaction(async (tx) => {
    await tabloHazirla(tx as unknown as { $executeRawUnsafe: (q: string) => Promise<unknown> });

    // ---- geri alma için tam kopya ----
    const yedek = await tx.$queryRaw<unknown[]>`
      select cari_kod, kod, ad, kanal, sevkiyat, malzeme_kodu from portfoy.teslim_noktasi`;
    const kayit = await tx.$queryRaw<{ id: bigint }[]>`
      insert into portfoy.yukleme (kullanici, ozet, yedek)
      values (${kullanici},
              ${JSON.stringify({ satir: satirlar.length, kararlar })}::jsonb,
              ${JSON.stringify(yedek)}::jsonb)
      returning id`;
    yuklemeId = Number(kayit[0].id);

    // ---- yeni cariler (teslim noktalariyla birlikte) ----
    // Bir cari onaylandiysa noktalari da onunla gelir; noktasiz cari hacimsizdir,
    // yuku sifir cikar ve ise yaramaz.
    for (const c of kararlar.eklenecekCari ?? []) {
      const kendiNoktalari = [...dosya.entries()].filter(([k]) => k.startsWith(c.kod + "|"));
      const ad = kendiNoktalari[0]?.[1].ad || c.kod;
      await tx.$executeRaw`
        insert into portfoy.cari (kod, ad, kanal) values (${c.kod}, ${ad}, ${c.kanal})
        on conflict (kod) do nothing`;
      sayac.yeniCari++;

      for (const [anahtar, d] of kendiNoktalari) {
        const kod = anahtar.slice(c.kod.length + 1);
        await tx.$executeRaw`
          insert into portfoy.teslim_noktasi (cari_kod, kod, ad, kanal, sevkiyat, malzeme_kodu)
          values (${c.kod}, ${kod}, ${d.ad || kod}, ${d.kanal ?? c.kanal},
                  ${d.sevkiyat ?? 0}, ${d.malzeme ?? 0})
          on conflict (cari_kod, kod) do nothing`;
        sayac.yeniNokta++;
      }
    }

    // ---- yeni teslim noktaları ----
    for (const anahtar of kararlar.eklenecekNokta ?? []) {
      const d = dosya.get(anahtar);
      if (!d) continue;
      const [cari_kod, kod] = anahtar.split("|");
      const varMi = await tx.$queryRaw<{ n: bigint }[]>`
        select count(*) n from portfoy.cari where kod = ${cari_kod}`;
      if (!Number(varMi[0].n)) { sayac.atlanan++; continue; }   // carisi eklenmediyse nokta da eklenmez
      await tx.$executeRaw`
        insert into portfoy.teslim_noktasi (cari_kod, kod, ad, kanal, sevkiyat, malzeme_kodu)
        values (${cari_kod}, ${kod}, ${d.ad || kod},
                coalesce(${d.kanal}, (select kanal from portfoy.cari where kod = ${cari_kod})),
                ${d.sevkiyat ?? 0}, ${d.malzeme ?? 0})
        on conflict (cari_kod, kod) do nothing`;
      sayac.yeniNokta++;
    }

    // ---- mevcut noktaların hacmi ----
    if (kararlar.hacimGuncelle !== false) {
      for (const [anahtar, d] of dosya) {
        // #N/A geldiyse mevcut değer korunur
        if (d.sevkiyat === null && d.malzeme === null) { sayac.atlanan++; continue; }
        const [cari_kod, kod] = anahtar.split("|");
        const n = await tx.$executeRaw`
          update portfoy.teslim_noktasi set
            sevkiyat     = coalesce(${d.sevkiyat}, sevkiyat),
            malzeme_kodu = coalesce(${d.malzeme}, malzeme_kodu)
          where cari_kod = ${cari_kod} and kod = ${kod}`;
        if (Number(n)) sayac.guncellenen++;
      }
    }

    // ---- onaylanan kayıp noktalar ----
    for (const anahtar of kararlar.kaldirilacakNokta ?? []) {
      const [cari_kod, kod] = anahtar.split("|");
      await tx.$executeRaw`
        delete from portfoy.teslim_noktasi where cari_kod = ${cari_kod} and kod = ${kod}`;
      sayac.kaldirilan++;
    }

    await tx.$executeRaw`
      update portfoy.yukleme set ozet = ozet || ${JSON.stringify({ sayac })}::jsonb
      where id = ${yuklemeId}`;
    await tx.$executeRaw`
      insert into portfoy.degisiklik_log (tablo, kayit_id, alan, yeni, kullanici)
      values ('(veri yukleme)', ${String(yuklemeId)}, 'excel',
              ${`${sayac.yeniCari} yeni cari · ${sayac.yeniNokta} yeni nokta · ` +
                `${sayac.guncellenen} güncellendi · ${sayac.kaldirilan} kaldırıldı`},
              ${kullanici})`;
  }, { timeout: 120000 });

  return { yuklemeId, sayac };
}

/**
 * Bir yüklemeyi geri alır.
 *
 * Teslim noktaları yükleme öncesi hâline döner. O yüklemede eklenen cariler de
 * silinir — ama YALNIZ dokunulmamış olanlar: temsilcisi atanmışsa veya
 * sınıflandırma alanlarından biri doldurulmuşsa bırakılır, çünkü o iş
 * yüklemeden sonra yapılmış demektir.
 */
export async function geriAl(yuklemeId: number, kullanici: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.$queryRaw<{ yedek: unknown; geri_alindi: boolean; ozet: unknown }[]>`
      select yedek, geri_alindi, ozet from portfoy.yukleme where id = ${yuklemeId}`;
    if (!r.length) throw new Error("Yükleme kaydı bulunamadı.");
    if (r[0].geri_alindi) throw new Error("Bu yükleme zaten geri alınmış.");
    const satirlar = r[0].yedek as {
      cari_kod: string; kod: string; ad: string; kanal: number | null;
      sevkiyat: number; malzeme_kodu: number;
    }[];

    await tx.$executeRaw`delete from portfoy.teslim_noktasi`;
    for (const s of satirlar) {
      await tx.$executeRaw`
        insert into portfoy.teslim_noktasi (cari_kod, kod, ad, kanal, sevkiyat, malzeme_kodu)
        values (${s.cari_kod}, ${s.kod}, ${s.ad}, ${s.kanal},
                ${Number(s.sevkiyat)}, ${Number(s.malzeme_kodu)})`;
    }
    // yuklemede eklenen, sonradan dokunulmamis cariler
    const ozet = r[0].ozet as { kararlar?: { eklenecekCari?: { kod: string }[] } } | null;
    let silinen = 0;
    for (const c of ozet?.kararlar?.eklenecekCari ?? []) {
      const n = await tx.$executeRaw`
        delete from portfoy.cari
         where kod = ${c.kod}
           and not exists (select 1 from portfoy.portfoy p where p.cari_kod = kod)
           and not exists (select 1 from portfoy.cari_zorunlu z where z.cari_kod = kod)
           and segment is null and onem is null and zorluk is null
           and siparis_tipi is null and kim_oduyor is null and ekipman is null
           and portal is null and etiket is null and asn is null`;
      silinen += Number(n);
    }

    await tx.$executeRaw`update portfoy.yukleme set geri_alindi = true where id = ${yuklemeId}`;
    await tx.$executeRaw`
      insert into portfoy.degisiklik_log (tablo, kayit_id, alan, yeni, kullanici)
      values ('(veri yukleme)', ${String(yuklemeId)}, 'geri al',
              ${`${satirlar.length} satır geri yüklendi · ${silinen} cari silindi`}, ${kullanici})`;
  }, { timeout: 120000 });
}
