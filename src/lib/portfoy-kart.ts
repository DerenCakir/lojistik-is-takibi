import { db } from "@/lib/db";
import { kartIzinleri, type KartIzin } from "@/lib/portfoy-izin";

/**
 * Müşteri Kartları — notlar ve yedek temsilciler.
 *
 * Yalnız üç yeni tabloya yazar: not_turu, cari_not, cari_yedek.
 * Mevcut tablolara (cari, portfoy, teslim_noktasi…) DOKUNMAZ; canlı
 * rakamlar her seferinde hesaplama view'lerinden okunur, kopya tutulmaz.
 * Notlar silinmez: eskiyen "geçersiz" işaretlenir, tarihçe kalır.
 */

export type KartSatir = {
  kod: string; ad: string; kanal: number | null; aktif: boolean;
  temsilci: string;            // "AD" | "AD %60 · AD %40" | ""
  ekip: string | null;
  yedek: number;               // 0..2
  not: number;                 // geçerli not sayısı
  dikkat: boolean;             // önemli başlıkta geçerli not var mı
};

export type Yedek = { sira: number; temsilci_id: number; ad: string; ekip: string | null;
                      puan: number; cari_sayisi: number };
export type Not = { id: number; tur_id: number | null; tur: string; onemli: boolean;
                    metin: string; yazan: string | null; ts: string; gecerli: boolean;
                    izin: string | null };   // devir notuysa "AD · 10.10–24.10"
export type Tur = { id: number; ad: string; sira: number; onemli: boolean; aktif: boolean; kullanim: number };
export type Temsilci = { id: number; ad: string; ekip: string | null; puan: number; cari_sayisi: number };

export type KartDetay = {
  kod: string; ad: string; kanal: number | null; aktif: boolean; segment: string | null;
  temsilci: string; ekip: string | null; zorunlu: number;
  yuk: number; puan: number | null; nokta: number; noktaAktif: number; sevkiyat: number;
  sonDegisiklik: { ts: string; kullanici: string | null } | null;
  yedekler: Yedek[];
  notlar: Not[];
  izinler: KartIzin[];                          // temsilcisi izinde/yakında izinde mi, kim bakıyor
  hatirlatmalar: { id: number; tarih: string; metin: string; yapildi: boolean; sorumlu: string | null }[];
};

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

// -------------------------------------------------------------- liste
export async function kartListesi(): Promise<KartSatir[]> {
  const rows = await db.$queryRaw<{
    kod: string; ad: string; kanal: number | null; aktif: boolean;
    temsilci: string | null; ekip: string | null;
    yedek: bigint; notsay: bigint; dikkat: boolean;
  }[]>`
    with atama as (
      select p.cari_kod,
             string_agg(case when p.pay >= 99.99 then t.ad
                             else t.ad || ' %' || round(p.pay)::text end,
                        ' · ' order by p.pay desc, t.ad)      as temsilci,
             min(t.ekip)                                       as ekip
      from portfoy.portfoy p join portfoy.temsilci t on t.id = p.temsilci_id
      group by p.cari_kod
    )
    select c.kod, c.ad, c.kanal, c.aktif,
           a.temsilci, a.ekip,
           (select count(*) from portfoy.cari_yedek y where y.cari_kod = c.kod)          as yedek,
           (select count(*) from portfoy.cari_not  x where x.cari_kod = c.kod and x.gecerli) as notsay,
           exists (select 1 from portfoy.cari_not x join portfoy.not_turu t on t.id = x.tur_id
                    where x.cari_kod = c.kod and x.gecerli and t.onemli)                 as dikkat
    from portfoy.cari c
    left join atama a on a.cari_kod = c.kod
    order by c.ad`;
  return rows.map((r) => ({
    kod: r.kod, ad: r.ad, kanal: r.kanal, aktif: r.aktif,
    temsilci: r.temsilci ?? "", ekip: r.ekip,
    yedek: n(r.yedek), not: n(r.notsay), dikkat: !!r.dikkat,
  }));
}

// -------------------------------------------------------------- detay
export async function kartDetay(kod: string): Promise<KartDetay | null> {
  const [c] = await db.$queryRaw<{
    kod: string; ad: string; kanal: number | null; aktif: boolean; segment: string | null;
    temsilci: string | null; ekip: string | null; zorunlu: bigint;
    yuk: number; nl: bigint; al: bigint; sv: bigint;
  }[]>`
    select c.kod, c.ad, c.kanal, c.aktif, c.segment,
           (select string_agg(case when p.pay >= 99.99 then t.ad
                                   else t.ad || ' %' || round(p.pay)::text end,
                              ' · ' order by p.pay desc, t.ad)
              from portfoy.portfoy p join portfoy.temsilci t on t.id = p.temsilci_id
             where p.cari_kod = c.kod)                                          as temsilci,
           (select min(t.ekip) from portfoy.portfoy p join portfoy.temsilci t on t.id = p.temsilci_id
             where p.cari_kod = c.kod)                                          as ekip,
           (select count(*) from portfoy.cari_zorunlu z where z.cari_kod = c.kod) as zorunlu,
           y.yuk, y.nl, y.al, y.sv
    from portfoy.cari c
    join portfoy.v_cari_yuk y on y.cari_kod = c.kod
    where c.kod = ${kod}`;
  if (!c) return null;

  // temsilcinin puanı (bölüşümde ilk temsilci)
  const [p] = await db.$queryRaw<{ puan: number }[]>`
    select tp.puan from portfoy.portfoy pf
    join portfoy.v_temsilci_puan tp on tp.temsilci_id = pf.temsilci_id
    where pf.cari_kod = ${kod} order by pf.pay desc limit 1`;

  const [son] = await db.$queryRaw<{ ts: Date; kullanici: string | null }[]>`
    select ts, kullanici from portfoy.degisiklik_log
    where kayit_id = ${kod} order by ts desc limit 1`;

  const yedekler = await db.$queryRaw<{
    sira: number; temsilci_id: bigint; ad: string; ekip: string | null; puan: number; cari_sayisi: number;
  }[]>`
    select y.sira, y.temsilci_id, t.ad, t.ekip,
           coalesce(tp.puan, 0) as puan, coalesce(tp.cari_sayisi, 0) as cari_sayisi
    from portfoy.cari_yedek y
    join portfoy.temsilci t on t.id = y.temsilci_id
    left join portfoy.v_temsilci_puan tp on tp.temsilci_id = y.temsilci_id
    where y.cari_kod = ${kod} order by y.sira`;

  const notlar = await db.$queryRaw<{
    id: bigint; tur_id: bigint | null; tur: string | null; onemli: boolean | null;
    metin: string; yazan: string | null; ts: Date; gecerli: boolean; izin: string | null;
  }[]>`
    select x.id, x.tur_id, t.ad as tur, t.onemli, x.metin, x.yazan, x.ts, x.gecerli,
           (select ti.ad || ' · ' || to_char(i.baslangic,'DD.MM') || '–' || to_char(i.bitis,'DD.MM')
              from portfoy.izin i join portfoy.temsilci ti on ti.id = i.temsilci_id
             where i.id = x.izin_id) as izin
    from portfoy.cari_not x left join portfoy.not_turu t on t.id = x.tur_id
    where x.cari_kod = ${kod}
    order by x.gecerli desc, coalesce(t.onemli, false) desc, coalesce(t.sira, 999), x.ts desc`;

  const izinlerK = await kartIzinleri(kod);
  const hat = await db.$queryRaw<{ id: bigint; tarih: Date; metin: string; yapildi: boolean; sorumlu: string | null }[]>`
    select h.id, h.tarih, h.metin, h.yapildi,
           coalesce(ts.ad, (select tb.ad from portfoy.izin_devir d join portfoy.temsilci tb on tb.id = d.bakan_temsilci_id
                              where d.izin_id = h.izin_id and d.cari_kod = h.cari_kod)) as sorumlu
    from portfoy.hatirlatma h left join portfoy.temsilci ts on ts.id = h.sorumlu_temsilci_id
    where h.cari_kod = ${kod} and (not h.yapildi or h.yapildi_ts > now() - interval '14 days')
    order by h.yapildi, h.tarih`;

  return {
    kod: c.kod, ad: c.ad, kanal: c.kanal, aktif: c.aktif, segment: c.segment,
    temsilci: c.temsilci ?? "", ekip: c.ekip, zorunlu: n(c.zorunlu),
    yuk: Number(c.yuk), puan: p ? Number(p.puan) : null,
    nokta: n(c.nl), noktaAktif: n(c.al), sevkiyat: n(c.sv),
    sonDegisiklik: son ? { ts: son.ts.toISOString(), kullanici: son.kullanici } : null,
    yedekler: yedekler.map((y) => ({
      sira: y.sira, temsilci_id: Number(y.temsilci_id), ad: y.ad, ekip: y.ekip,
      puan: Number(y.puan), cari_sayisi: Number(y.cari_sayisi),
    })),
    notlar: notlar.map((x) => ({
      id: Number(x.id), tur_id: x.tur_id === null ? null : Number(x.tur_id),
      tur: x.tur ?? "(başlıksız)", onemli: !!x.onemli, metin: x.metin, yazan: x.yazan,
      ts: x.ts.toISOString(), gecerli: x.gecerli, izin: x.izin,
    })),
    izinler: izinlerK,
    hatirlatmalar: hat.map((h) => ({ id: Number(h.id), tarih: h.tarih.toISOString().slice(0, 10),
                                     metin: h.metin, yapildi: h.yapildi, sorumlu: h.sorumlu })),
  };
}

// -------------------------------------------------------------- yardımcı listeler
export async function turler(): Promise<Tur[]> {
  const rows = await db.$queryRaw<{
    id: bigint; ad: string; sira: number; onemli: boolean; aktif: boolean; kullanim: bigint;
  }[]>`
    select t.id, t.ad, t.sira, t.onemli, t.aktif,
           (select count(*) from portfoy.cari_not x where x.tur_id = t.id and x.gecerli) as kullanim
    from portfoy.not_turu t order by t.sira, t.ad`;
  return rows.map((t) => ({ ...t, id: Number(t.id), kullanim: n(t.kullanim) }));
}

export async function temsilciler(): Promise<Temsilci[]> {
  const rows = await db.$queryRaw<{
    id: bigint; ad: string; ekip: string | null; puan: number; cari_sayisi: number;
  }[]>`
    select t.id, t.ad, t.ekip, coalesce(tp.puan, 0) as puan, coalesce(tp.cari_sayisi, 0) as cari_sayisi
    from portfoy.temsilci t
    left join portfoy.v_temsilci_puan tp on tp.temsilci_id = t.id
    where t.aktif order by t.ad`;
  return rows.map((t) => ({ id: Number(t.id), ad: t.ad, ekip: t.ekip,
                             puan: Number(t.puan), cari_sayisi: Number(t.cari_sayisi) }));
}

// -------------------------------------------------------------- yazma
async function logla(tablo: string, kod: string, alan: string,
                     eski: string | null, yeni: string | null, kullanici: string) {
  await db.$executeRaw`
    insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
    values (${tablo}, ${kod}, ${alan}, ${eski}, ${yeni}, ${kullanici})`;
}

export async function notEkle(kod: string, turId: number | null, metin: string, kullanici: string,
                              izinId: number | null = null) {
  const m = metin.trim();
  if (!m) throw new Error("Not boş olamaz.");
  if (m.length > 4000) throw new Error("Not çok uzun (4000 karakter sınırı).");
  const [r] = await db.$queryRaw<{ id: bigint }[]>`
    insert into portfoy.cari_not (cari_kod, tur_id, metin, yazan, izin_id)
    values (${kod}, ${turId}, ${m}, ${kullanici}, ${izinId}) returning id`;
  const [t] = turId === null ? [null]
    : await db.$queryRaw<{ ad: string }[]>`select ad from portfoy.not_turu where id = ${turId}`;
  await logla("cari_not", kod, `${izinId ? "devir notu" : "not"} · ${t?.ad ?? "başlıksız"}`, null,
              m.length > 120 ? m.slice(0, 117) + "…" : m, kullanici);
  return Number(r.id);
}

export async function notGecerlilik(id: number, gecerli: boolean, kullanici: string) {
  const [x] = await db.$queryRaw<{ cari_kod: string; metin: string }[]>`
    update portfoy.cari_not set gecerli = ${gecerli} where id = ${id}
    returning cari_kod, metin`;
  if (!x) throw new Error("Not bulunamadı.");
  await logla("cari_not", x.cari_kod, "not durumu",
              gecerli ? "geçersiz" : "geçerli", gecerli ? "geçerli" : "geçersiz", kullanici);
}

export async function yedekAyarla(kod: string, sira: 1 | 2, temsilciId: number | null, kullanici: string) {
  const [eski] = await db.$queryRaw<{ ad: string }[]>`
    select t.ad from portfoy.cari_yedek y join portfoy.temsilci t on t.id = y.temsilci_id
    where y.cari_kod = ${kod} and y.sira = ${sira}`;
  if (temsilciId === null) {
    await db.$executeRaw`delete from portfoy.cari_yedek where cari_kod = ${kod} and sira = ${sira}`;
  } else {
    // aynı kişi iki sırada olmasın
    const [ayni] = await db.$queryRaw<{ sira: number }[]>`
      select sira from portfoy.cari_yedek where cari_kod = ${kod} and temsilci_id = ${temsilciId} and sira <> ${sira}`;
    if (ayni) throw new Error("Aynı temsilci hem 1. hem 2. yedek olamaz.");
    await db.$executeRaw`
      insert into portfoy.cari_yedek (cari_kod, sira, temsilci_id, guncelleyen)
      values (${kod}, ${sira}, ${temsilciId}, ${kullanici})
      on conflict (cari_kod, sira) do update
        set temsilci_id = excluded.temsilci_id, guncelleyen = excluded.guncelleyen, guncelleme = now()`;
  }
  const [yeni] = temsilciId === null ? [null]
    : await db.$queryRaw<{ ad: string }[]>`select ad from portfoy.temsilci where id = ${temsilciId}`;
  await logla("cari_yedek", kod, `${sira}. yedek`, eski?.ad ?? null, yeni?.ad ?? null, kullanici);
}

export async function turEkle(ad: string, onemli: boolean, kullanici: string) {
  const a = ad.trim();
  if (a.length < 2) throw new Error("Başlık en az 2 karakter olmalı.");
  await db.$executeRaw`
    insert into portfoy.not_turu (ad, onemli, sira)
    values (${a}, ${onemli}, (select coalesce(max(sira), 0) + 10 from portfoy.not_turu where sira < 90))
    on conflict (ad) do update set aktif = true, onemli = excluded.onemli`;
  await logla("not_turu", "-", "başlık eklendi", null, a, kullanici);
}

export async function turGuncelle(id: number, ad: string, onemli: boolean, aktif: boolean, kullanici: string) {
  const a = ad.trim();
  if (a.length < 2) throw new Error("Başlık en az 2 karakter olmalı.");
  const [eski] = await db.$queryRaw<{ ad: string; onemli: boolean; aktif: boolean }[]>`
    select ad, onemli, aktif from portfoy.not_turu where id = ${id}`;
  if (!eski) throw new Error("Başlık bulunamadı.");
  await db.$executeRaw`update portfoy.not_turu set ad = ${a}, onemli = ${onemli}, aktif = ${aktif} where id = ${id}`;
  if (eski.ad !== a) await logla("not_turu", "-", "başlık adı", eski.ad, a, kullanici);
  if (eski.aktif !== aktif) await logla("not_turu", "-", `başlık · ${a}`, eski.aktif ? "aktif" : "pasif", aktif ? "aktif" : "pasif", kullanici);
}
