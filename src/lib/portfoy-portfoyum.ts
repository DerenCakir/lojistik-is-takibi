import { db } from "@/lib/db";
import { notEkle, notGecerlilik, yedekEkle, yedekSil, yedekSira } from "@/lib/portfoy-kart";

/**
 * "Portföyüm" — temsilcinin kendi sayfası.
 *
 * Her fonksiyon temsilci kimliğiyle çağrılır ve SUNUCUDA süzer: temsilci
 * yalnız asıl temsilcisi ya da yedeği olduğu müşterileri görebilir. Adres
 * çubuğuna başka bir kod yazılırsa boş döner; başkasının müşterisine
 * yazma denemesi hata verir.
 *
 * Bu dosya PUAN, YÜK, SEVKİYAT, SINIFLANDIRMA okumaz. Yalnız ad, kod,
 * kanal, notlar, yedekler, değerlendirmeler, izin şeridi ve hatırlatmalar.
 * Ana portalın tablolarına yazmaz.
 */

export type Durum = "tam" | "aktarim" | "yok";
export type Hazirlik = { toplam: number; tam: number; aktarim: number; yok: number; bekleyen: number; yuzde: number };

export type BenimMusterim = {
  kod: string; ad: string; kanal: number | null; pay: number;
  notSayisi: number; dikkat: boolean;
  yedekler: { id: number; ad: string; hazirlik: Hazirlik }[];
};
export type YedegiOldugum = {
  kod: string; ad: string; kanal: number | null;
  asil: string; asilId: number;
  notSayisi: number; hazirlik: Hazirlik; yeni: number;           // yeni = değerlendirilmemiş
  bakacagim: { baslangic: string; bitis: string } | null;         // izin_devir'de bakan = ben
  secildi: string;                                                // yedek seçildiği tarih
};
export type NotSatir = {
  id: number; tur: string; onemli: boolean; metin: string; yazan: string | null; ts: string;
  gecerli: boolean; izin: string | null;
  benimDurumum: Durum | null;                                    // yedek görünümünde
  degerlendirmeler: { yedek: string; durum: Durum }[];            // asıl görünümünde
};
export type MusteriDetay = {
  kod: string; ad: string; kanal: number | null; segment: string | null; aktif: boolean;
  rol: "asil" | "yedek"; asil: string; pay: number;
  yedekler: { id: number; ad: string; ekip: string | null; sira: number; hazirlik: Hazirlik }[];
  notlar: NotSatir[];
  izinler: { temsilci: string; bakan: string | null; baslangic: string; bitis: string; durum: "planli" | "suruyor" }[];
  hatirlatmalar: { id: number; tarih: string; metin: string; yapildi: boolean; sorumlu: string | null }[];
  turler: { id: number; ad: string; onemli: boolean }[];
};
export type Hatirlatmam = { id: number; cari_kod: string; cari_ad: string; tarih: string; metin: string; izin: string | null; yapildi: boolean; gecikme: number };

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const d10 = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
const bugun = () => d10(new Date());

// -------------------------------------------------------------- yetki kontrolleri
/** Temsilci bu müşterinin ASIL temsilcisi mi (bölüşüm payı dahil)? */
async function asilMi(temsilciId: number, kod: string) {
  const [r] = await db.$queryRaw<{ n: bigint }[]>`
    select count(*) n from portfoy.portfoy where temsilci_id = ${temsilciId} and cari_kod = ${kod}`;
  return n(r.n) > 0;
}
async function yedekMi(temsilciId: number, kod: string) {
  const [r] = await db.$queryRaw<{ n: bigint }[]>`
    select count(*) n from portfoy.cari_yedek where temsilci_id = ${temsilciId} and cari_kod = ${kod}`;
  return n(r.n) > 0;
}

// -------------------------------------------------------------- hazırlık hesabı
/** Bir yedeğin bir müşterideki hazırlığı: geçerli notlar üzerinden. */
async function hazirlikHesapla(kod: string, yedekId: number): Promise<Hazirlik> {
  const [r] = await db.$queryRaw<{ toplam: bigint; tam: bigint; aktarim: bigint; yok: bigint }[]>`
    select count(*) as toplam,
           count(*) filter (where d.durum = 'tam')     as tam,
           count(*) filter (where d.durum = 'aktarim') as aktarim,
           count(*) filter (where d.durum = 'yok')     as yok
    from portfoy.cari_not x
    left join portfoy.yedek_degerlendirme d on d.not_id = x.id and d.yedek_temsilci_id = ${yedekId}
    where x.cari_kod = ${kod} and x.gecerli`;
  const toplam = n(r.toplam), tam = n(r.tam), aktarim = n(r.aktarim), yok = n(r.yok);
  return { toplam, tam, aktarim, yok, bekleyen: toplam - tam - aktarim - yok,
           yuzde: toplam ? Math.round(tam / toplam * 100) : 0 };
}

// -------------------------------------------------------------- müşterilerim
export async function benimMusterilerim(temsilciId: number): Promise<BenimMusterim[]> {
  const rows = await db.$queryRaw<{
    kod: string; ad: string; kanal: number | null; pay: number; notsay: bigint; dikkat: boolean;
  }[]>`
    select c.kod, c.ad, c.kanal, p.pay,
           (select count(*) from portfoy.cari_not x where x.cari_kod = c.kod and x.gecerli) as notsay,
           exists (select 1 from portfoy.cari_not x join portfoy.not_turu t on t.id = x.tur_id
                    where x.cari_kod = c.kod and x.gecerli and t.onemli) as dikkat
    from portfoy.portfoy p join portfoy.cari c on c.kod = p.cari_kod
    where p.temsilci_id = ${temsilciId} and c.aktif
    order by c.ad`;
  const yed = await db.$queryRaw<{ cari_kod: string; id: bigint; ad: string; sira: number }[]>`
    select y.cari_kod, y.temsilci_id as id, t.ad, y.sira
    from portfoy.cari_yedek y join portfoy.temsilci t on t.id = y.temsilci_id
    where y.cari_kod in (select cari_kod from portfoy.portfoy where temsilci_id = ${temsilciId})
    order by y.cari_kod, y.sira, t.ad`;
  const out: BenimMusterim[] = [];
  for (const r of rows) {
    const yedekler = [];
    for (const y of yed.filter((x) => x.cari_kod === r.kod)) {
      yedekler.push({ id: Number(y.id), ad: y.ad, hazirlik: await hazirlikHesapla(r.kod, Number(y.id)) });
    }
    out.push({ kod: r.kod, ad: r.ad, kanal: r.kanal, pay: Number(r.pay), notSayisi: n(r.notsay), dikkat: !!r.dikkat, yedekler });
  }
  return out;
}

// -------------------------------------------------------------- yedeği olduğum
export async function yedegiOldugum(temsilciId: number): Promise<YedegiOldugum[]> {
  const rows = await db.$queryRaw<{
    kod: string; ad: string; kanal: number | null; asil: string | null; asil_id: bigint | null;
    notsay: bigint; secildi: Date; bas: Date | null; bit: Date | null;
  }[]>`
    select c.kod, c.ad, c.kanal,
           (select t.ad from portfoy.portfoy p join portfoy.temsilci t on t.id = p.temsilci_id
             where p.cari_kod = c.kod order by p.pay desc limit 1) as asil,
           (select p.temsilci_id from portfoy.portfoy p where p.cari_kod = c.kod order by p.pay desc limit 1) as asil_id,
           (select count(*) from portfoy.cari_not x where x.cari_kod = c.kod and x.gecerli) as notsay,
           y.guncelleme as secildi,
           (select i.baslangic from portfoy.izin_devir d join portfoy.izin i on i.id = d.izin_id
             where d.cari_kod = c.kod and d.bakan_temsilci_id = ${temsilciId} and not i.iptal and i.bitis >= current_date
             order by i.baslangic limit 1) as bas,
           (select i.bitis from portfoy.izin_devir d join portfoy.izin i on i.id = d.izin_id
             where d.cari_kod = c.kod and d.bakan_temsilci_id = ${temsilciId} and not i.iptal and i.bitis >= current_date
             order by i.baslangic limit 1) as bit
    from portfoy.cari_yedek y join portfoy.cari c on c.kod = y.cari_kod
    where y.temsilci_id = ${temsilciId} and c.aktif
    order by y.guncelleme desc`;
  const out: YedegiOldugum[] = [];
  for (const r of rows) {
    const h = await hazirlikHesapla(r.kod, temsilciId);
    out.push({ kod: r.kod, ad: r.ad, kanal: r.kanal, asil: r.asil ?? "(atanmamış)", asilId: r.asil_id === null ? 0 : Number(r.asil_id),
               notSayisi: n(r.notsay), hazirlik: h, yeni: h.bekleyen,
               bakacagim: r.bas && r.bit ? { baslangic: d10(r.bas), bitis: d10(r.bit) } : null,
               secildi: r.secildi.toISOString() });
  }
  return out;
}

// -------------------------------------------------------------- müşteri detayı (rakam yok)
export async function musteriDetay(temsilciId: number, kod: string): Promise<MusteriDetay | null> {
  const asil = await asilMi(temsilciId, kod);
  const yedek = !asil && await yedekMi(temsilciId, kod);
  if (!asil && !yedek) return null;                                  // ne asılı ne yedeği: görünmez

  const [c] = await db.$queryRaw<{ kod: string; ad: string; kanal: number | null; segment: string | null; aktif: boolean;
                                    asil: string | null; pay: number | null }[]>`
    select c.kod, c.ad, c.kanal, c.segment, c.aktif,
           (select string_agg(t.ad, ' · ' order by p.pay desc) from portfoy.portfoy p join portfoy.temsilci t on t.id = p.temsilci_id
             where p.cari_kod = c.kod) as asil,
           (select p.pay from portfoy.portfoy p where p.cari_kod = c.kod and p.temsilci_id = ${temsilciId}) as pay
    from portfoy.cari c where c.kod = ${kod}`;
  if (!c) return null;

  const yed = await db.$queryRaw<{ id: bigint; ad: string; ekip: string | null; sira: number }[]>`
    select y.temsilci_id as id, t.ad, t.ekip, y.sira from portfoy.cari_yedek y join portfoy.temsilci t on t.id = y.temsilci_id
    where y.cari_kod = ${kod} order by y.sira, t.ad`;
  const yedekler = [];
  for (const y of yed) yedekler.push({ id: Number(y.id), ad: y.ad, ekip: y.ekip, sira: y.sira, hazirlik: await hazirlikHesapla(kod, Number(y.id)) });

  const notlar = await db.$queryRaw<{
    id: bigint; tur: string | null; onemli: boolean | null; metin: string; yazan: string | null; ts: Date; gecerli: boolean;
    izin: string | null; benim: Durum | null; degs: string | null;
  }[]>`
    select x.id, t.ad as tur, t.onemli, x.metin, x.yazan, x.ts, x.gecerli,
           (select ti.ad || ' · ' || to_char(i.baslangic,'DD.MM') || '–' || to_char(i.bitis,'DD.MM')
              from portfoy.izin i join portfoy.temsilci ti on ti.id = i.temsilci_id where i.id = x.izin_id) as izin,
           (select d.durum from portfoy.yedek_degerlendirme d where d.not_id = x.id and d.yedek_temsilci_id = ${temsilciId}) as benim,
           (select json_agg(json_build_object('yedek', ty.ad, 'durum', d.durum) order by ty.ad)::text
              from portfoy.yedek_degerlendirme d join portfoy.temsilci ty on ty.id = d.yedek_temsilci_id
             where d.not_id = x.id) as degs
    from portfoy.cari_not x left join portfoy.not_turu t on t.id = x.tur_id
    where x.cari_kod = ${kod}
    order by x.gecerli desc, coalesce(t.onemli,false) desc, coalesce(t.sira,999), x.ts desc`;

  const izinler = await db.$queryRaw<{ temsilci: string; bakan: string | null; baslangic: Date; bitis: Date }[]>`
    select t.ad as temsilci, tb.ad as bakan, i.baslangic, i.bitis
    from portfoy.izin i join portfoy.temsilci t on t.id = i.temsilci_id
    join portfoy.portfoy p on p.temsilci_id = i.temsilci_id and p.cari_kod = ${kod}
    left join portfoy.izin_devir d on d.izin_id = i.id and d.cari_kod = ${kod}
    left join portfoy.temsilci tb on tb.id = d.bakan_temsilci_id
    where not i.iptal and i.bitis >= current_date order by i.baslangic`;

  const hat = await db.$queryRaw<{ id: bigint; tarih: Date; metin: string; yapildi: boolean; sorumlu: string | null }[]>`
    select h.id, h.tarih, h.metin, h.yapildi,
           coalesce(ts.ad, (select tb.ad from portfoy.izin_devir d join portfoy.temsilci tb on tb.id = d.bakan_temsilci_id
                              where d.izin_id = h.izin_id and d.cari_kod = h.cari_kod)) as sorumlu
    from portfoy.hatirlatma h left join portfoy.temsilci ts on ts.id = h.sorumlu_temsilci_id
    where h.cari_kod = ${kod} and (not h.yapildi or h.yapildi_ts > now() - interval '14 days')
    order by h.yapildi, h.tarih`;

  const turler = await db.$queryRaw<{ id: bigint; ad: string; onemli: boolean }[]>`
    select id, ad, onemli from portfoy.not_turu where aktif order by sira, ad`;

  const t = bugun();
  return {
    kod: c.kod, ad: c.ad, kanal: c.kanal, segment: c.segment, aktif: c.aktif,
    rol: asil ? "asil" : "yedek", asil: c.asil ?? "(atanmamış)", pay: c.pay === null ? 0 : Number(c.pay),
    yedekler,
    notlar: notlar.map((x) => ({
      id: Number(x.id), tur: x.tur ?? "(başlıksız)", onemli: !!x.onemli, metin: x.metin, yazan: x.yazan,
      ts: x.ts.toISOString(), gecerli: x.gecerli, izin: x.izin, benimDurumum: x.benim,
      degerlendirmeler: JSON.parse(x.degs ?? "[]"),
    })),
    izinler: izinler.map((z) => ({ temsilci: z.temsilci, bakan: z.bakan, baslangic: d10(z.baslangic), bitis: d10(z.bitis),
                                   durum: t < d10(z.baslangic) ? "planli" : "suruyor" })),
    hatirlatmalar: hat.map((h) => ({ id: Number(h.id), tarih: d10(h.tarih), metin: h.metin, yapildi: h.yapildi, sorumlu: h.sorumlu })),
    turler: turler.map((x) => ({ id: Number(x.id), ad: x.ad, onemli: x.onemli })),
  };
}

// -------------------------------------------------------------- yazma (hepsi sahiplik kontrollü)
export async function benimNotEkle(temsilciId: number, kod: string, turId: number | null, metin: string, kullanici: string) {
  if (!(await asilMi(temsilciId, kod))) throw new Error("Bu müşteri senin portföyünde değil.");
  return notEkle(kod, turId, metin, kullanici);
}
export async function benimNotGecersiz(temsilciId: number, notId: number, gecerli: boolean, kullanici: string) {
  const [x] = await db.$queryRaw<{ cari_kod: string; yazan: string | null }[]>`select cari_kod, yazan from portfoy.cari_not where id = ${notId}`;
  if (!x) throw new Error("Not bulunamadı.");
  if (!(await asilMi(temsilciId, x.cari_kod))) throw new Error("Bu müşteri senin portföyünde değil.");
  if (x.yazan !== kullanici) throw new Error("Yalnız kendi yazdığın notu geçersiz yapabilirsin.");
  return notGecerlilik(notId, gecerli, kullanici);
}
export async function benimYedekEkle(temsilciId: number, kod: string, yedekId: number, kullanici: string) {
  if (!(await asilMi(temsilciId, kod))) throw new Error("Bu müşteri senin portföyünde değil.");
  if (yedekId === temsilciId) throw new Error("Kendini yedek seçemezsin.");
  return yedekEkle(kod, yedekId, kullanici);
}
export async function benimYedekSil(temsilciId: number, kod: string, yedekId: number, kullanici: string) {
  if (!(await asilMi(temsilciId, kod))) throw new Error("Bu müşteri senin portföyünde değil.");
  return yedekSil(kod, yedekId, kullanici);
}
export async function benimYedekSira(temsilciId: number, kod: string, yedekId: number, yon: "yukari" | "asagi", kullanici: string) {
  if (!(await asilMi(temsilciId, kod))) throw new Error("Bu müşteri senin portföyünde değil.");
  return yedekSira(kod, yedekId, yon, kullanici);
}

/** Yedek, bir notu değerlendirir. Yalnız yedeği olduğu müşterinin notu. */
export async function degerlendir(temsilciId: number, notId: number, durum: Durum, kullanici: string) {
  const [x] = await db.$queryRaw<{ cari_kod: string; gecerli: boolean }[]>`select cari_kod, gecerli from portfoy.cari_not where id = ${notId}`;
  if (!x) throw new Error("Not bulunamadı.");
  if (!(await yedekMi(temsilciId, x.cari_kod))) throw new Error("Bu müşterinin yedeği değilsin.");
  await db.$executeRaw`
    insert into portfoy.yedek_degerlendirme (not_id, yedek_temsilci_id, durum)
    values (${notId}, ${temsilciId}, ${durum})
    on conflict (not_id, yedek_temsilci_id) do update set durum = excluded.durum, ts = now()`;
  const AD: Record<Durum, string> = { tam: "bilgim tam", aktarim: "aktarım gerekli", yok: "hiç fikrim yok" };
  await db.$executeRaw`
    insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
    values ('yedek_degerlendirme', ${x.cari_kod}, ${"değerlendirme · not #" + notId}, null, ${AD[durum]}, ${kullanici})`;
}

// -------------------------------------------------------------- hatırlatmalarım
export async function hatirlatmalarim(temsilciId: number): Promise<Hatirlatmam[]> {
  const rows = await db.$queryRaw<{ id: bigint; cari_kod: string; cari_ad: string; tarih: Date; metin: string; izin: string | null; yapildi: boolean }[]>`
    select h.id, h.cari_kod, c.ad as cari_ad, h.tarih, h.metin, h.yapildi,
           (select ti.ad || ' · ' || to_char(i.baslangic,'DD.MM') || '–' || to_char(i.bitis,'DD.MM')
              from portfoy.izin i join portfoy.temsilci ti on ti.id = i.temsilci_id where i.id = h.izin_id) as izin
    from portfoy.hatirlatma h join portfoy.cari c on c.kod = h.cari_kod
    where (h.sorumlu_temsilci_id = ${temsilciId}
           or exists (select 1 from portfoy.izin_devir d where d.izin_id = h.izin_id and d.cari_kod = h.cari_kod and d.bakan_temsilci_id = ${temsilciId})
           or (h.izin_id is null and h.sorumlu_temsilci_id is null
               and exists (select 1 from portfoy.portfoy p where p.cari_kod = h.cari_kod and p.temsilci_id = ${temsilciId})))
      and (not h.yapildi or h.yapildi_ts > now() - interval '14 days')
    order by h.yapildi, h.tarih`;
  const t = bugun();
  return rows.map((r) => ({ id: Number(r.id), cari_kod: r.cari_kod, cari_ad: r.cari_ad, tarih: d10(r.tarih), metin: r.metin,
                            izin: r.izin, yapildi: r.yapildi,
                            gecikme: Math.round((new Date(t + "T00:00:00Z").getTime() - new Date(d10(r.tarih) + "T00:00:00Z").getTime()) / 86400000) }));
}
export async function hatirlatmamYapildi(temsilciId: number, id: number, yapildi: boolean, kullanici: string) {
  const benim = (await hatirlatmalarim(temsilciId)).some((h) => h.id === id);
  if (!benim) throw new Error("Bu hatırlatma sana düşmüyor.");
  await db.$executeRaw`update portfoy.hatirlatma set yapildi = ${yapildi},
    yapan = case when ${yapildi} then ${kullanici} else null end,
    yapildi_ts = case when ${yapildi} then now() else null end where id = ${id}`;
}

// -------------------------------------------------------------- yönetici tarafı: hesap bağlama
export async function kullaniciBagla(temsilciId: number, kullaniciAdi: string | null, kullanici: string) {
  const [t] = await db.$queryRaw<{ ad: string }[]>`select ad from portfoy.temsilci where id = ${temsilciId}`;
  if (!t) throw new Error("Temsilci bulunamadı.");
  const [eski] = await db.$queryRaw<{ kullanici_adi: string }[]>`select kullanici_adi from portfoy.temsilci_kullanici where temsilci_id = ${temsilciId}`;
  if (!kullaniciAdi) {
    await db.$executeRaw`delete from portfoy.temsilci_kullanici where temsilci_id = ${temsilciId}`;
  } else {
    const ad = kullaniciAdi.trim();
    const u = await db.user.findUnique({ where: { username: ad }, select: { username: true, role: true, isAdmin: true } });
    if (!u) throw new Error(`"${ad}" adlı kullanıcı yok. Önce Kullanıcılar sayfasından hesabı açın.`);
    if (u.isAdmin || u.role === "MUDUR" || u.role === "YONETICI") throw new Error("Yönetici hesabı temsilciye bağlanamaz.");
    await db.$executeRaw`
      insert into portfoy.temsilci_kullanici (temsilci_id, kullanici_adi, baglayan) values (${temsilciId}, ${ad}, ${kullanici})
      on conflict (temsilci_id) do update set kullanici_adi = excluded.kullanici_adi, baglayan = excluded.baglayan, ts = now()`;
  }
  await db.$executeRaw`
    insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
    values ('temsilci', ${String(temsilciId)}, ${"kullanıcı adı · " + t.ad}, ${eski?.kullanici_adi ?? null}, ${kullaniciAdi?.trim() ?? null}, ${kullanici})`;
}
export async function kullaniciBaglari(): Promise<Record<number, string>> {
  const rows = await db.$queryRaw<{ temsilci_id: bigint; kullanici_adi: string }[]>`select temsilci_id, kullanici_adi from portfoy.temsilci_kullanici`;
  return Object.fromEntries(rows.map((r) => [Number(r.temsilci_id), r.kullanici_adi]));
}

/** Yönetici görünümü için: bir müşterinin yedeklerinin hazırlığı. */
export async function yedekHazirliklari(kod: string): Promise<{ id: number; ad: string; hazirlik: Hazirlik }[]> {
  const yed = await db.$queryRaw<{ id: bigint; ad: string }[]>`
    select y.temsilci_id as id, t.ad from portfoy.cari_yedek y join portfoy.temsilci t on t.id = y.temsilci_id
    where y.cari_kod = ${kod} order by y.sira, t.ad`;
  const out = [];
  for (const y of yed) out.push({ id: Number(y.id), ad: y.ad, hazirlik: await hazirlikHesapla(kod, Number(y.id)) });
  return out;
}
