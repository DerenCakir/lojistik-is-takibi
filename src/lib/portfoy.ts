import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";

/**
 * Portföy İş Yükü — veri erişimi.
 *
 * Veriler Supabase'deki AYRI bir `portfoy` şemasında durur; İş Takibi'nin
 * `public` şemasıyla hiçbir teması yoktur. Bu yüzden Prisma modeli
 * tanımlanmaz, `schema.prisma` dosyasına dokunulmaz — erişim ham SQL ile
 * yapılır. Böylece `prisma migrate` portföy şemasını hiç görmez.
 *
 * HESAP BURADA YAPILMAZ. Yük, puan ve duyarlılık değerleri veritabanı
 * view'lerinden okunur (v_cari_yuk, v_temsilci_puan, v_cari_duyarlilik).
 * Formülün ikinci bir kopyası uygulama kodunda bulunmaz.
 */

// ---------------------------------------------------------------- yetki

export type PortfoyYetki = "duzenle_tumu" | "duzenle_siniflandirma" | "oku";

/** İş Takibi rollerini portföy yetkisine çevirir. */
export function portfoyYetki(user: CurrentUser): PortfoyYetki {
  if (user.isAdmin || user.role === "MUDUR") return "duzenle_tumu";
  if (user.role === "YONETICI") return "duzenle_siniflandirma";
  return "oku";
}

export function yazabilir(y: PortfoyYetki) {
  return y !== "oku";
}

// ---------------------------------------------------------------- tipler

export type TemsilciPuan = {
  temsilci: string;
  ekip: string | null;
  unvan: number | null;
  cari_sayisi: number;
  sevkiyat: number;
  teslim_noktasi: number;
  malzeme_kodu: number;
  yurtdisi_sayisi: number;
  yuk_toplam: number;
  gonullu_puan: number;
  puan: number;
};

export type CariSatir = {
  cari_kod: string;
  cari_ad: string;
  kanal: number | null;
  segment: string | null;
  onem: number | null;
  zorluk: number | null;
  siparis_tipi: string | null;
  kim_oduyor: string | null;
  ekipman: string | null;
  portal: string | null;
  etiket: string | null;
  asn: string | null;
  nl: number;
  al: number;
  sv: number;
  gm: number;
  operasyon_kat: number;
  nitelik_kat: number;
  zorluk_carpani: number;
  hacim: number;
  yuk: number;
  bos_hucre: number;
  temsilciler: string | null; // "AD %85 · AD %15"
};

export type PortfoyOzet = {
  cari: number;
  teslim_noktasi: number;
  sevkiyat: number;
  malzeme_kodu: number;
  bos_hucre: number;
  eksiksiz: number;
  temsilcisiz: number;
};

// Sayısal alanlar Postgres'ten string/numeric gelebilir — tek yerde çeviriyoruz.
const s = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

// ---------------------------------------------------------------- erişim

/**
 * Portföy şeması okunabiliyor mu?
 *
 * Yerel geliştirmede DATABASE_URL SQLite'ı gösterir (tasarım önizlemesi);
 * portföy verisi yalnız Railway'deki Supabase bağlantısında bulunur.
 * Sayfalar bunu kontrol edip çökmek yerine açıklayıcı mesaj gösterir.
 */
export async function portfoyErisilebilir(): Promise<boolean> {
  try {
    await db.$queryRaw`select 1 from portfoy.cari limit 1`;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- okuma

export async function temsilciPuanlari(): Promise<TemsilciPuan[]> {
  const rows = await db.$queryRaw<Record<string, unknown>[]>`
    select temsilci, ekip, unvan, cari_sayisi, sevkiyat, teslim_noktasi,
           malzeme_kodu, yurtdisi_sayisi, yuk_toplam, gonullu_puan, puan
    from portfoy.v_temsilci_puan
    order by puan desc
  `;
  return rows.map((r) => ({
    temsilci: String(r.temsilci),
    ekip: (r.ekip as string) ?? null,
    unvan: r.unvan === null ? null : Number(r.unvan),
    cari_sayisi: s(r.cari_sayisi),
    sevkiyat: s(r.sevkiyat),
    teslim_noktasi: s(r.teslim_noktasi),
    malzeme_kodu: s(r.malzeme_kodu),
    yurtdisi_sayisi: s(r.yurtdisi_sayisi),
    yuk_toplam: s(r.yuk_toplam),
    gonullu_puan: s(r.gonullu_puan),
    puan: s(r.puan),
  }));
}

export async function cariler(): Promise<CariSatir[]> {
  const rows = await db.$queryRaw<Record<string, unknown>[]>`
    select y.cari_kod, y.cari_ad, y.kanal,
           c.segment, c.onem, c.zorluk, c.siparis_tipi, c.kim_oduyor,
           c.ekipman, c.portal, c.etiket, c.asn,
           y.nl, y.al, y.sv, y.gm,
           y.operasyon_kat, y.nitelik_kat, y.zorluk_carpani, y.hacim, y.yuk,
           d.bos_hucre,
           (select string_agg(
                     coalesce(t.ad, '(atanmamış)') ||
                     case when p.pct < 99.99
                          then ' %' || round(p.pct::numeric, 0)
                          else '' end,
                     ' · ' order by p.pct desc)
              from portfoy.v_cari_pay p
              left join portfoy.temsilci t on t.id = p.temsilci_id
             where p.cari_kod = y.cari_kod) as temsilciler
    from portfoy.v_cari_yuk y
    join portfoy.cari c on c.kod = y.cari_kod
    join portfoy.v_alan_denetim d on d.cari_kod = y.cari_kod
    order by y.yuk desc
  `;
  return rows.map((r) => ({
    cari_kod: String(r.cari_kod),
    cari_ad: String(r.cari_ad),
    kanal: r.kanal === null ? null : Number(r.kanal),
    segment: (r.segment as string) ?? null,
    onem: r.onem === null ? null : Number(r.onem),
    zorluk: r.zorluk === null ? null : Number(r.zorluk),
    siparis_tipi: (r.siparis_tipi as string) ?? null,
    kim_oduyor: (r.kim_oduyor as string) ?? null,
    ekipman: (r.ekipman as string) ?? null,
    portal: (r.portal as string) ?? null,
    etiket: (r.etiket as string) ?? null,
    asn: (r.asn as string) ?? null,
    nl: s(r.nl), al: s(r.al), sv: s(r.sv), gm: s(r.gm),
    operasyon_kat: s(r.operasyon_kat),
    nitelik_kat: s(r.nitelik_kat),
    zorluk_carpani: s(r.zorluk_carpani),
    hacim: s(r.hacim),
    yuk: s(r.yuk),
    bos_hucre: s(r.bos_hucre),
    temsilciler: (r.temsilciler as string) ?? null,
  }));
}

export async function ozet(): Promise<PortfoyOzet> {
  const rows = await db.$queryRaw<Record<string, unknown>[]>`
    select (select count(*) from portfoy.cari)                              as cari,
           (select count(*) from portfoy.teslim_noktasi)                    as teslim_noktasi,
           (select coalesce(sum(sevkiyat),0) from portfoy.teslim_noktasi)   as sevkiyat,
           (select coalesce(sum(malzeme_kodu),0) from portfoy.teslim_noktasi) as malzeme_kodu,
           (select coalesce(sum(bos_hucre),0) from portfoy.v_alan_denetim)  as bos_hucre,
           (select count(*) from portfoy.v_alan_denetim where bos_hucre = 0) as eksiksiz,
           (select count(*) from portfoy.cari c
             where not exists (select 1 from portfoy.portfoy p where p.cari_kod = c.kod)) as temsilcisiz
  `;
  const r = rows[0] ?? {};
  return {
    cari: s(r.cari),
    teslim_noktasi: s(r.teslim_noktasi),
    sevkiyat: s(r.sevkiyat),
    malzeme_kodu: s(r.malzeme_kodu),
    bos_hucre: s(r.bos_hucre),
    eksiksiz: s(r.eksiksiz),
    temsilcisiz: s(r.temsilcisiz),
  };
}

// ---------------------------------------------------------------- yanit

/**
 * JSON yanıtı.
 *
 * Postgres'in bigint/numeric alanları Prisma'dan BigInt veya Decimal olarak
 * gelir; JSON.stringify ikisini de serileştiremez. Sayıya çeviriyoruz.
 */
export function jsonCevap(veri: unknown, durum = 200) {
  const metin = JSON.stringify(veri, (_k, v) => {
    if (typeof v === "bigint") return Number(v);
    if (v && typeof v === "object" && typeof (v as { toNumber?: unknown }).toNumber === "function") {
      return (v as { toNumber: () => number }).toNumber();
    }
    return v;
  });
  return new Response(metin, {
    status: durum,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// ---------------------------------------------------------------- anlik veri

/**
 * Portalın (public/portfoy) beklediği tam anlık görüntü.
 *
 * Tek istekte tüm tabloları ve hesap view'lerini döner; portal bunu alıp
 * yedi sekmeyi çizer. Hesap yine veritabanında yapılır — buradan sadece
 * hazır değerler geçer.
 */
export async function anlikVeri() {
  const q = <T,>(sql: string) => db.$queryRawUnsafe<T[]>(sql);
  const [cari, pay, duyarlilik, temsilci, temsilciler, cariAlan, lokasyon,
         zorunluTur, cariZorunlu, gonulluTur, gonulluKayit, katsayi, parametre,
         alanDenetim] = await Promise.all([
    q(`select * from portfoy.v_cari_yuk order by cari_kod`),
    q(`select * from portfoy.v_cari_pay`),
    q(`select cari_kod, degisken, ham_deger, etki from portfoy.v_cari_duyarlilik`),
    q(`select * from portfoy.v_temsilci_puan order by puan desc`),
    q(`select id, ad, ekip, unvan, aktif from portfoy.temsilci order by ad`),
    q(`select kod, ad, kanal, segment, onem, zorluk, siparis_tipi,
              kim_oduyor, ekipman, portal, etiket, asn, aktif,
              gecici, asil_temsilci
         from portfoy.cari order by kod`),
    q(`select cari_kod, kod, ad, kanal, sevkiyat, malzeme_kodu, aktif
         from portfoy.teslim_noktasi`),
    q(`select id, ad, katsayi from portfoy.zorunlu_tur order by id`),
    q(`select cari_kod, zorunlu_tur_id from portfoy.cari_zorunlu`),
    q(`select id, ad, puan from portfoy.gonullu_tur order by id`),
    q(`select id, gonullu_tur_id, temsilci_id, aciklama, puan
         from portfoy.gonullu_kayit order by id`),
    q(`select grup, anahtar, deger from portfoy.katsayi order by grup, anahtar`),
    q(`select anahtar, deger from portfoy.parametre order by anahtar`),
    q(`select cari_kod, bos_hucre from portfoy.v_alan_denetim`),
  ]);
  return { cari, pay, duyarlilik, temsilci, temsilciler, cariAlan, lokasyon,
           zorunluTur, cariZorunlu, gonulluTur, gonulluKayit, katsayi, parametre,
           alanDenetim };
}

/** Dağıtım tahtasının "ne olurdu" hesabı — model yine veritabanında. */
export async function senaryoPuan(
  atamalar: { cari_kod: string; temsilci_id: number | null; pay?: number }[],
) {
  return db.$queryRaw<Record<string, unknown>[]>`
    select * from portfoy.f_senaryo_puan(${JSON.stringify(atamalar)}::jsonb)
  `;
}

// ---------------------------------------------------------------- degisiklik kaydi

export type Degisiklik = {
  id: number; ts: string; kullanici: string | null;
  tablo: string; kayit_id: string; alan: string | null;
  eski: string | null; yeni: string | null;
  cari_ad: string | null;   // kayit_id bir cari koduysa adı
};

/** Son değişiklik — portal başlığında gösterilir. */
export async function sonDegisiklik(): Promise<{ kullanici: string; ts: Date } | null> {
  const r = await db.$queryRaw<{ kullanici: string | null; ts: Date }[]>`
    select kullanici, ts from portfoy.degisiklik_log order by ts desc limit 1`;
  if (!r.length) return null;
  return { kullanici: r[0].kullanici ?? "—", ts: r[0].ts };
}

/** Değişiklik geçmişi. */
export async function degisiklikler(limit = 2000): Promise<Degisiklik[]> {
  const r = await db.$queryRaw<Record<string, unknown>[]>`
    select l.id, l.ts, l.kullanici, l.tablo, l.kayit_id, l.alan, l.eski, l.yeni,
           c.ad as cari_ad
    from portfoy.degisiklik_log l
    left join portfoy.cari c on c.kod = l.kayit_id
    order by l.ts desc, l.id desc limit ${limit}`;
  return r.map((x) => ({
    id: Number(x.id), ts: String(x.ts), kullanici: (x.kullanici as string) ?? null,
    tablo: String(x.tablo), kayit_id: String(x.kayit_id),
    alan: (x.alan as string) ?? null, eski: (x.eski as string) ?? null,
    yeni: (x.yeni as string) ?? null, cari_ad: (x.cari_ad as string) ?? null,
  }));
}

// ---------------------------------------------------------------- yazma

/** Düzenlenebilir sınıflandırma alanları ve kabul edilen değerleri. */
export const ALANLAR = {
  segment: ["Ana Otomotiv", "Tier-1", "Toptancı", "After Market", "Beyaz Eşya",
            "Holding Firması", "GMBH Yan Sanayi", "Kıtalararası Müşteri",
            "POTANSİYEL MÜŞTERİ"],
  onem: ["1", "2", "3", "4"],
  zorluk: ["1", "2", "3", "4"],
  siparis_tipi: ["EDI", "MANUEL"],
  kim_oduyor: ["Müşteri", "NORM CİVATA"],
  ekipman: ["var", "yok"],
  portal: ["Aktif kullanılıyor", "Bazen kullanılıyor", "Hiç kullanılmıyor"],
  etiket: ["var", "yok"],
  asn: ["var", "yok"],
} as const;

export type AlanAdi = keyof typeof ALANLAR;

const SAYISAL: AlanAdi[] = ["onem", "zorluk"];

export function gecerliAlan(alan: string): alan is AlanAdi {
  return Object.prototype.hasOwnProperty.call(ALANLAR, alan);
}

/**
 * Tek bir sınıflandırma hücresini günceller.
 * Kolon adı sabit listeden seçilir (SQL enjeksiyonuna kapalı),
 * değer de o alanın izin verilen seçenekleri arasından doğrulanır.
 */
export async function cariAlanGuncelle(kod: string, alan: AlanAdi, deger: string) {
  const secenekler = ALANLAR[alan] as readonly string[];
  const temiz = deger.trim();
  if (temiz !== "" && !secenekler.includes(temiz)) {
    throw new Error(`Geçersiz değer: ${alan} = ${temiz}`);
  }
  const bos = temiz === "";

  // Kolon adı literal olarak yazılır; `alan` yukarıda tip düzeyinde daraltıldı.
  switch (alan) {
    case "segment":
      await db.$executeRaw`update portfoy.cari set segment = ${bos ? null : temiz}, guncelleme = now() where kod = ${kod}`;
      break;
    case "onem":
      await db.$executeRaw`update portfoy.cari set onem = ${bos ? null : Number(temiz)}, guncelleme = now() where kod = ${kod}`;
      break;
    case "zorluk":
      await db.$executeRaw`update portfoy.cari set zorluk = ${bos ? null : Number(temiz)}, guncelleme = now() where kod = ${kod}`;
      break;
    case "siparis_tipi":
      await db.$executeRaw`update portfoy.cari set siparis_tipi = ${bos ? null : temiz}, guncelleme = now() where kod = ${kod}`;
      break;
    case "kim_oduyor":
      await db.$executeRaw`update portfoy.cari set kim_oduyor = ${bos ? null : temiz}, guncelleme = now() where kod = ${kod}`;
      break;
    case "ekipman":
      await db.$executeRaw`update portfoy.cari set ekipman = ${bos ? null : temiz}, guncelleme = now() where kod = ${kod}`;
      break;
    case "portal":
      await db.$executeRaw`update portfoy.cari set portal = ${bos ? null : temiz}, guncelleme = now() where kod = ${kod}`;
      break;
    case "etiket":
      await db.$executeRaw`update portfoy.cari set etiket = ${bos ? null : temiz}, guncelleme = now() where kod = ${kod}`;
      break;
    case "asn":
      await db.$executeRaw`update portfoy.cari set asn = ${bos ? null : temiz}, guncelleme = now() where kod = ${kod}`;
      break;
  }
  void SAYISAL;
}

/** Değişiklik kaydı — kim, neyi, ne zaman değiştirdi. */
export async function logla(
  kayitId: string, alan: string, eski: string | null, yeni: string | null, kullanici: string,
) {
  await db.$executeRaw`
    insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
    values ('cari', ${kayitId}, ${alan}, ${eski}, ${yeni}, ${kullanici})
  `;
}
