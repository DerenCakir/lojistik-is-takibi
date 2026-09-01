import "server-only";
import { db } from "./db";

/**
 * Temsilci yönetimi — yeni gelen, ayrılan, adı değişen.
 *
 * Ayrılan kişi SİLİNMEZ, pasife alınır. Portföyü devredilmeden pasife
 * alınamaz; alınsa yükü kimseye gitmez ve toplam bozulur.
 */

export type TemsilciSatir = {
  id: number; ad: string; ekip: string | null; unvan: number | null;
  aktif: boolean; cari: number; yuk: number; puan: number; gonullu: number;
};

export async function listele(): Promise<TemsilciSatir[]> {
  const r = await db.$queryRaw<Record<string, unknown>[]>`
    select t.id, t.ad, t.ekip, t.unvan, t.aktif,
           coalesce(v.cari_sayisi, 0)  as cari,
           coalesce(v.yuk_toplam, 0)   as yuk,
           coalesce(v.puan, 0)         as puan,
           (select count(*) from portfoy.gonullu_kayit g where g.temsilci_id = t.id) as gonullu
    from portfoy.temsilci t
    left join portfoy.v_temsilci_puan v on v.temsilci_id = t.id
    order by t.aktif desc, coalesce(v.puan, 0) desc, t.ad`;
  return r.map((x) => ({
    id: Number(x.id), ad: String(x.ad),
    ekip: (x.ekip as string) ?? null,
    unvan: x.unvan === null ? null : Number(x.unvan),
    aktif: Boolean(x.aktif),
    cari: Number(x.cari), yuk: Number(x.yuk), puan: Number(x.puan),
    gonullu: Number(x.gonullu),
  }));
}

function adDogrula(ad: string) {
  const t = (ad ?? "").trim().replace(/\s+/g, " ");
  if (t.length < 3) throw new Error("Ad en az 3 karakter olmalı.");
  if (t.length > 80) throw new Error("Ad çok uzun.");
  return t;
}
const ekipDogrula = (e: unknown) => (e === "YD" || e === "YI" ? e : null);
const unvanDogrula = (u: unknown) => {
  const n = Number(u);
  return n >= 1 && n <= 3 ? n : null;
};

export async function ekle(ad: string, ekip: unknown, unvan: unknown, kullanici: string) {
  const t = adDogrula(ad);
  const varMi = await db.$queryRaw<{ n: bigint }[]>`
    select count(*) n from portfoy.temsilci where lower(ad) = lower(${t})`;
  if (Number(varMi[0].n)) throw new Error(`"${t}" zaten kayıtlı.`);

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      insert into portfoy.temsilci (ad, ekip, unvan, aktif)
      values (${t}, ${ekipDogrula(ekip)}, ${unvanDogrula(unvan)}, true)`;
    await tx.$executeRaw`
      insert into portfoy.degisiklik_log (tablo, kayit_id, alan, yeni, kullanici)
      values ('temsilci', ${t}, 'yeni temsilci', ${t}, ${kullanici})`;
  });
}

export async function guncelle(
  id: number, ad: string, ekip: unknown, unvan: unknown, kullanici: string,
) {
  const t = adDogrula(ad);
  const eski = await db.$queryRaw<{ ad: string }[]>`
    select ad from portfoy.temsilci where id = ${id}`;
  if (!eski.length) throw new Error("Temsilci bulunamadı.");

  const cakisma = await db.$queryRaw<{ n: bigint }[]>`
    select count(*) n from portfoy.temsilci where lower(ad) = lower(${t}) and id <> ${id}`;
  if (Number(cakisma[0].n)) throw new Error(`"${t}" başka bir kayıtta kullanılıyor.`);

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      update portfoy.temsilci
         set ad = ${t}, ekip = ${ekipDogrula(ekip)}, unvan = ${unvanDogrula(unvan)}
       where id = ${id}`;
    if (eski[0].ad !== t) {
      await tx.$executeRaw`
        insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
        values ('temsilci', ${String(id)}, 'ad', ${eski[0].ad}, ${t}, ${kullanici})`;
    }
  });
}

/**
 * Ayrıldı olarak işaretler. Portföyü boş değilse reddeder — önce müşterileri
 * devredilmeli, yoksa yükü hiçbir temsilciye gitmez.
 */
export async function pasifeAl(id: number, kullanici: string) {
  const r = await db.$queryRaw<{ ad: string; cari: bigint }[]>`
    select t.ad, (select count(*) from portfoy.portfoy p where p.temsilci_id = t.id) as cari
    from portfoy.temsilci t where t.id = ${id}`;
  if (!r.length) throw new Error("Temsilci bulunamadı.");
  const cari = Number(r[0].cari);
  if (cari > 0) {
    throw new Error(
      `${r[0].ad} hâlâ ${cari} müşteriye bakıyor. Önce dağıtım ekranından ` +
      `portföyünü devredin, sonra ayrıldı olarak işaretleyin.`);
  }
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`update portfoy.temsilci set aktif = false where id = ${id}`;
    await tx.$executeRaw`
      insert into portfoy.degisiklik_log (tablo, kayit_id, alan, yeni, kullanici)
      values ('temsilci', ${r[0].ad}, 'ayrıldı', 'pasif', ${kullanici})`;
  });
}

export async function aktifEt(id: number, kullanici: string) {
  const r = await db.$queryRaw<{ ad: string }[]>`
    select ad from portfoy.temsilci where id = ${id}`;
  if (!r.length) throw new Error("Temsilci bulunamadı.");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`update portfoy.temsilci set aktif = true where id = ${id}`;
    await tx.$executeRaw`
      insert into portfoy.degisiklik_log (tablo, kayit_id, alan, yeni, kullanici)
      values ('temsilci', ${r[0].ad}, 'geri alındı', 'aktif', ${kullanici})`;
  });
}

/**
 * Bir temsilcinin tüm müşterilerini başkasına devreder.
 * Bölüşümlerde yalnız o kişinin payı hedefe geçer, diğer paydaş korunur.
 */
export async function portfoyDevret(kaynakId: number, hedefId: number, kullanici: string) {
  if (kaynakId === hedefId) throw new Error("Kaynak ve hedef aynı olamaz.");
  const r = await db.$queryRaw<{ id: number; ad: string }[]>`
    select id, ad from portfoy.temsilci where id in (${kaynakId}, ${hedefId})`;
  if (r.length < 2) throw new Error("Temsilci bulunamadı.");
  const kaynak = r.find((x) => Number(x.id) === kaynakId)!;
  const hedef = r.find((x) => Number(x.id) === hedefId)!;

  let adet = 0;
  await db.$transaction(async (tx) => {
    // Hedefte zaten pay varsa ikisi birleşir; yoksa satır hedefe taşınır.
    const birlesen = await tx.$executeRaw`
      update portfoy.portfoy h
         set pay = h.pay + k.pay
        from portfoy.portfoy k
       where k.temsilci_id = ${kaynakId} and h.temsilci_id = ${hedefId}
         and h.cari_kod = k.cari_kod`;
    await tx.$executeRaw`
      delete from portfoy.portfoy k
       where k.temsilci_id = ${kaynakId}
         and exists (select 1 from portfoy.portfoy h
                      where h.temsilci_id = ${hedefId} and h.cari_kod = k.cari_kod)`;
    const tasinan = await tx.$executeRaw`
      update portfoy.portfoy set temsilci_id = ${hedefId} where temsilci_id = ${kaynakId}`;
    adet = Number(birlesen) + Number(tasinan);
    await tx.$executeRaw`
      insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
      values ('portfoy', '(devir)', 'portföy devri',
              ${kaynak.ad}, ${`${hedef.ad} · ${adet} müşteri`}, ${kullanici})`;
  });
  return adet;
}
