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
  yedek: number;               // yedek sayısı
  not: number;                 // geçerli not sayısı
  dikkat: boolean;             // önemli başlıkta geçerli not var mı
  hazirlik: number | null;     // en hazır yedeğin yüzdesi (yedek/not yoksa null)
};

export type Yedek = { sira: number; temsilci_id: number; ad: string; ekip: string | null;
                      puan: number; cari_sayisi: number; yetkinlik: string | null;
                      hazirlik: { toplam: number; tam: number; aktarim: number; yok: number; bekleyen: number; yuzde: number } };
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
    yedek: bigint; notsay: bigint; dikkat: boolean; hazirlik: number | null;
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
                    where x.cari_kod = c.kod and x.gecerli and t.onemli)                 as dikkat,
           (select max(h.yuzde) from (
              select case when count(x.id) = 0 then null
                          else round(100.0 * count(d.durum) filter (where d.durum = 'tam') / count(x.id)) end as yuzde
              from portfoy.cari_yedek y
              left join portfoy.cari_not x on x.cari_kod = y.cari_kod and x.gecerli
              left join portfoy.yedek_degerlendirme d on d.not_id = x.id and d.yedek_temsilci_id = y.temsilci_id
              where y.cari_kod = c.kod group by y.temsilci_id) h)                          as hazirlik
    from portfoy.cari c
    left join atama a on a.cari_kod = c.kod
    order by c.ad`;
  return rows.map((r) => ({
    kod: r.kod, ad: r.ad, kanal: r.kanal, aktif: r.aktif,
    temsilci: r.temsilci ?? "", ekip: r.ekip,
    yedek: n(r.yedek), not: n(r.notsay), dikkat: !!r.dikkat,
    hazirlik: r.hazirlik === null ? null : Number(r.hazirlik),
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
    sira: number; temsilci_id: bigint; ad: string; ekip: string | null; puan: number; cari_sayisi: number; yetkinlik: string | null;
    h_toplam: bigint; h_tam: bigint; h_aktarim: bigint; h_yok: bigint;
  }[]>`
    select y.sira, y.temsilci_id, t.ad, t.ekip,
           coalesce(tp.puan, 0) as puan, coalesce(tp.cari_sayisi, 0) as cari_sayisi, y.yetkinlik,
           (select count(*) from portfoy.cari_not x where x.cari_kod = y.cari_kod and x.gecerli) as h_toplam,
           (select count(*) from portfoy.cari_not x join portfoy.yedek_degerlendirme d on d.not_id = x.id and d.yedek_temsilci_id = y.temsilci_id
             where x.cari_kod = y.cari_kod and x.gecerli and d.durum = 'tam') as h_tam,
           (select count(*) from portfoy.cari_not x join portfoy.yedek_degerlendirme d on d.not_id = x.id and d.yedek_temsilci_id = y.temsilci_id
             where x.cari_kod = y.cari_kod and x.gecerli and d.durum = 'aktarim') as h_aktarim,
           (select count(*) from portfoy.cari_not x join portfoy.yedek_degerlendirme d on d.not_id = x.id and d.yedek_temsilci_id = y.temsilci_id
             where x.cari_kod = y.cari_kod and x.gecerli and d.durum = 'yok') as h_yok
    from portfoy.cari_yedek y
    join portfoy.temsilci t on t.id = y.temsilci_id
    left join portfoy.v_temsilci_puan tp on tp.temsilci_id = y.temsilci_id
    where y.cari_kod = ${kod} order by y.sira, t.ad`;

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
      puan: Number(y.puan), cari_sayisi: Number(y.cari_sayisi), yetkinlik: y.yetkinlik,
      hazirlik: (() => { const t = n(y.h_toplam), a = n(y.h_tam), b = n(y.h_aktarim), c2 = n(y.h_yok);
        return { toplam: t, tam: a, aktarim: b, yok: c2, bekleyen: t - a - b - c2, yuzde: t ? Math.round(a / t * 100) : 0 }; })(),
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

export async function yedekEkle(kod: string, temsilciId: number, kullanici: string) {
  const [var_] = await db.$queryRaw<{ n: bigint }[]>`
    select count(*) n from portfoy.cari_yedek where cari_kod = ${kod} and temsilci_id = ${temsilciId}`;
  if (n(var_.n)) throw new Error("Bu kişi zaten yedek.");
  const [asil] = await db.$queryRaw<{ n: bigint }[]>`
    select count(*) n from portfoy.portfoy where cari_kod = ${kod} and temsilci_id = ${temsilciId}`;
  if (n(asil.n)) throw new Error("Asıl temsilci kendine yedek olamaz.");
  await db.$executeRaw`
    insert into portfoy.cari_yedek (cari_kod, temsilci_id, sira, guncelleyen)
    values (${kod}, ${temsilciId},
            (select coalesce(max(sira), 0) + 1 from portfoy.cari_yedek where cari_kod = ${kod}), ${kullanici})`;
  const [t] = await db.$queryRaw<{ ad: string }[]>`select ad from portfoy.temsilci where id = ${temsilciId}`;
  await logla("cari_yedek", kod, "yedek eklendi", null, t?.ad ?? null, kullanici);
}

export async function yedekSil(kod: string, temsilciId: number, kullanici: string) {
  const [t] = await db.$queryRaw<{ ad: string }[]>`
    delete from portfoy.cari_yedek y using portfoy.temsilci t
    where y.cari_kod = ${kod} and y.temsilci_id = ${temsilciId} and t.id = y.temsilci_id returning t.ad`;
  if (!t) throw new Error("Yedek bulunamadı.");
  await logla("cari_yedek", kod, "yedek çıkarıldı", t.ad, null, kullanici);
}

/** "Bu yedek neleri yapabilir" notu. */
export async function yedekYetkinlik(kod: string, temsilciId: number, yetkinlik: string, kullanici: string) {
  const y = yetkinlik.trim().slice(0, 1000) || null;
  const [r] = await db.$queryRaw<{ ad: string; eski: string | null }[]>`
    select t.ad, y.yetkinlik as eski from portfoy.cari_yedek y join portfoy.temsilci t on t.id = y.temsilci_id
    where y.cari_kod = ${kod} and y.temsilci_id = ${temsilciId}`;
  if (!r) throw new Error("Yedek bulunamadı.");
  if ((r.eski ?? "") === (y ?? "")) return;
  await db.$executeRaw`update portfoy.cari_yedek set yetkinlik = ${y}, guncelleyen = ${kullanici}, guncelleme = now()
    where cari_kod = ${kod} and temsilci_id = ${temsilciId}`;
  await logla("cari_yedek", kod, `yetkinlik · ${r.ad}`, r.eski, y, kullanici);
}

/** Sırayı bir yukarı/aşağı taşı. */
export async function yedekSira(kod: string, temsilciId: number, yon: "yukari" | "asagi", kullanici: string) {
  const liste = await db.$queryRaw<{ temsilci_id: bigint; sira: number }[]>`
    select temsilci_id, sira from portfoy.cari_yedek where cari_kod = ${kod} order by sira, temsilci_id`;
  const i = liste.findIndex((x) => Number(x.temsilci_id) === temsilciId);
  const j = yon === "yukari" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  for (let k = 0; k < liste.length; k++) {
    await db.$executeRaw`update portfoy.cari_yedek set sira = ${k + 1} where cari_kod = ${kod} and temsilci_id = ${liste[k].temsilci_id}`;
  }
  await logla("cari_yedek", kod, "yedek sırası", null, liste.map((x, k) => `${k + 1}:${x.temsilci_id}`).join(" "), kullanici);
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
