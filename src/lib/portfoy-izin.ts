import { db } from "@/lib/db";

/**
 * İzin & Devir + Hatırlatmalar — yalnız Müşteri Kartları içinde yaşar.
 *
 * Yazdığı tablolar: izin, izin_devir, hatirlatma (+ cari_not.izin_id).
 * Ana portalın tablolarına (portfoy, cari…) ve view'lerine DOKUNMAZ.
 * "Bu izinde kim bakıyor" bilgisi puana girmez, atamayı değiştirmez.
 * İzin bitince kendiliğinden "bitti" sayılır; geri alınacak bir şey yoktur.
 */

export type IzinTur = "izin" | "rapor" | "diger";
export type IzinDurum = "planli" | "suruyor" | "bitti";

export type Izin = {
  id: number; temsilci_id: number; temsilci: string; ekip: string | null;
  baslangic: string; bitis: string; gun: number; tur: IzinTur; aciklama: string | null;
  durum: IzinDurum; kalan: number;             // kalan: başlamasına kaç gün (planlı) / bitmesine (sürüyor)
  cari: number; devirli: number; aktarilan: number; // müşteri sayısı, bakanı seçilmiş, devir notu yazılmış
  cakisan: { temsilci: string; baslangic: string; bitis: string; gun: number }[];
};

export type TahtaSatir = {
  kod: string; ad: string; yuk: number; pay: number;
  yedekler: { id: number; ad: string; yetkinlik: string | null }[];   // sıralı, sınırsız
  bakan: number | null;
  aktarildi: boolean; aktaranNot: { yazan: string | null; ts: string; adet: number } | null;
  hatirlatmalar: { id: number; tarih: string; metin: string; yapildi: boolean }[];
};
export type Aday = {
  id: number; ad: string; ekip: string | null; puan: number; cari_sayisi: number;
  izinde: { baslangic: string; bitis: string; cakisma: number } | null;
  eklenen: number;                              // bu izinle üstüne binen müşteri sayısı
  eklenenYuk: number;
};
export type Tahta = { izin: Izin; satirlar: TahtaSatir[]; adaylar: Aday[] };

export type Hatirlatma = {
  id: number; cari_kod: string; cari_ad: string; tarih: string; metin: string;
  sorumlu: string | null; izin: string | null; olusturan: string | null;
  yapildi: boolean; yapan: string | null; gecikme: number;   // gün; 0 = bugün, negatif = ileride
};

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const d10 = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
const gunFarki = (a: string, b: string) =>
  Math.round((new Date(a + "T00:00:00Z").getTime() - new Date(b + "T00:00:00Z").getTime()) / 86400000);
const bugun = () => d10(new Date());
const durumHesapla = (bas: string, bit: string): { durum: IzinDurum; kalan: number } => {
  const t = bugun();
  if (t < bas) return { durum: "planli", kalan: gunFarki(bas, t) };
  if (t > bit) return { durum: "bitti", kalan: 0 };
  return { durum: "suruyor", kalan: gunFarki(bit, t) + 1 };
};
const cakismaGun = (a1: string, a2: string, b1: string, b2: string) => {
  const bas = a1 > b1 ? a1 : b1, bit = a2 < b2 ? a2 : b2;
  return bit >= bas ? gunFarki(bit, bas) + 1 : 0;
};

// -------------------------------------------------------------- izinler
export async function izinler(): Promise<Izin[]> {
  const rows = await db.$queryRaw<{
    id: bigint; temsilci_id: bigint; temsilci: string; ekip: string | null;
    baslangic: Date; bitis: Date; tur: IzinTur; aciklama: string | null;
    cari: bigint; devirli: bigint; aktarilan: bigint;
  }[]>`
    select i.id, i.temsilci_id, t.ad as temsilci, t.ekip, i.baslangic, i.bitis, i.tur, i.aciklama,
           (select count(distinct p.cari_kod) from portfoy.portfoy p where p.temsilci_id = i.temsilci_id) as cari,
           (select count(*) from portfoy.izin_devir d where d.izin_id = i.id)                          as devirli,
           (select count(distinct x.cari_kod) from portfoy.cari_not x where x.izin_id = i.id and x.gecerli) as aktarilan
    from portfoy.izin i join portfoy.temsilci t on t.id = i.temsilci_id
    where not i.iptal
    order by i.baslangic desc, i.id desc`;
  const liste = rows.map((r) => {
    const bas = d10(r.baslangic), bit = d10(r.bitis);
    return {
      id: Number(r.id), temsilci_id: Number(r.temsilci_id), temsilci: r.temsilci, ekip: r.ekip,
      baslangic: bas, bitis: bit, gun: gunFarki(bit, bas) + 1, tur: r.tur, aciklama: r.aciklama,
      ...durumHesapla(bas, bit),
      cari: n(r.cari), devirli: n(r.devirli), aktarilan: n(r.aktarilan), cakisan: [] as Izin["cakisan"],
    };
  });
  for (const a of liste) {
    a.cakisan = liste
      .filter((b) => b.id !== a.id && b.temsilci_id !== a.temsilci_id)
      .map((b) => ({ temsilci: b.temsilci, baslangic: b.baslangic, bitis: b.bitis,
                     gun: cakismaGun(a.baslangic, a.bitis, b.baslangic, b.bitis) }))
      .filter((c) => c.gun > 0);
  }
  return liste;
}

export async function izinEkle(temsilciId: number, baslangic: string, bitis: string,
                               tur: IzinTur, aciklama: string | null, kullanici: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baslangic) || !/^\d{4}-\d{2}-\d{2}$/.test(bitis)) throw new Error("Tarih biçimi hatalı.");
  if (bitis < baslangic) throw new Error("Bitiş, başlangıçtan önce olamaz.");
  if (gunFarki(bitis, baslangic) > 120) throw new Error("120 günden uzun izin girilemez.");
  const [c] = await db.$queryRaw<{ n: bigint }[]>`
    select count(*) n from portfoy.izin where temsilci_id = ${temsilciId} and not iptal
      and baslangic <= ${bitis}::date and bitis >= ${baslangic}::date`;
  if (n(c.n)) throw new Error("Bu kişinin aynı tarihlerde başka bir izni var.");
  const [r] = await db.$queryRaw<{ id: bigint }[]>`
    insert into portfoy.izin (temsilci_id, baslangic, bitis, tur, aciklama, olusturan)
    values (${temsilciId}, ${baslangic}::date, ${bitis}::date, ${tur}, ${aciklama}, ${kullanici})
    returning id`;
  const [t] = await db.$queryRaw<{ ad: string }[]>`select ad from portfoy.temsilci where id = ${temsilciId}`;
  await logla("izin", String(r.id), `izin · ${t?.ad ?? temsilciId}`, null, `${baslangic} → ${bitis} (${tur})`, kullanici);
  return Number(r.id);
}

export async function izinIptal(id: number, kullanici: string) {
  const [i] = await db.$queryRaw<{ temsilci: string; baslangic: Date; bitis: Date }[]>`
    update portfoy.izin i set iptal = true from portfoy.temsilci t
    where i.id = ${id} and t.id = i.temsilci_id returning t.ad as temsilci, i.baslangic, i.bitis`;
  if (!i) throw new Error("İzin bulunamadı.");
  await logla("izin", String(id), `izin · ${i.temsilci}`, `${d10(i.baslangic)} → ${d10(i.bitis)}`, "iptal", kullanici);
}

// -------------------------------------------------------------- tahta
export async function tahta(izinId: number): Promise<Tahta | null> {
  const izin = (await izinler()).find((i) => i.id === izinId);
  if (!izin) return null;

  const satirlar = await db.$queryRaw<{
    kod: string; ad: string; yuk: number; pay: number;
    yedekler: string | null;
    bakan: bigint | null; notAdet: bigint; notYazan: string | null; notTs: Date | null;
  }[]>`
    select c.kod, c.ad, y.yuk, p.pay,
           (select json_agg(json_build_object('id', yy.temsilci_id, 'ad', ty.ad, 'yetkinlik', yy.yetkinlik) order by yy.sira, ty.ad)::text
              from portfoy.cari_yedek yy join portfoy.temsilci ty on ty.id = yy.temsilci_id
             where yy.cari_kod = c.kod) as yedekler,
           dv.bakan_temsilci_id as bakan,
           (select count(*) from portfoy.cari_not x where x.cari_kod = c.kod and x.izin_id = ${izinId} and x.gecerli) as "notAdet",
           (select x.yazan from portfoy.cari_not x where x.cari_kod = c.kod and x.izin_id = ${izinId} and x.gecerli order by x.ts desc limit 1) as "notYazan",
           (select x.ts    from portfoy.cari_not x where x.cari_kod = c.kod and x.izin_id = ${izinId} and x.gecerli order by x.ts desc limit 1) as "notTs"
    from portfoy.portfoy p
    join portfoy.cari c on c.kod = p.cari_kod
    join portfoy.v_cari_yuk y on y.cari_kod = c.kod
    left join portfoy.izin_devir dv on dv.izin_id = ${izinId} and dv.cari_kod = c.kod
    where p.temsilci_id = ${izin.temsilci_id} and c.aktif
    order by y.yuk desc`;

  const hat = await db.$queryRaw<{ id: bigint; cari_kod: string; tarih: Date; metin: string; yapildi: boolean }[]>`
    select id, cari_kod, tarih, metin, yapildi from portfoy.hatirlatma
    where izin_id = ${izinId} order by tarih`;
  const hatM = new Map<string, TahtaSatir["hatirlatmalar"]>();
  for (const h of hat) {
    if (!hatM.has(h.cari_kod)) hatM.set(h.cari_kod, []);
    hatM.get(h.cari_kod)!.push({ id: Number(h.id), tarih: d10(h.tarih), metin: h.metin, yapildi: h.yapildi });
  }

  const S: TahtaSatir[] = satirlar.map((r) => ({
    kod: r.kod, ad: r.ad, yuk: Number(r.yuk) * Number(r.pay) / 100, pay: Number(r.pay),
    yedekler: (JSON.parse(r.yedekler ?? "[]") as { id: number | string; ad: string; yetkinlik: string | null }[])
      .map((y) => ({ id: Number(y.id), ad: y.ad, yetkinlik: y.yetkinlik })),
    bakan: r.bakan === null ? null : Number(r.bakan),
    aktarildi: n(r.notAdet) > 0,
    aktaranNot: n(r.notAdet) ? { yazan: r.notYazan, ts: r.notTs ? r.notTs.toISOString() : "", adet: n(r.notAdet) } : null,
    hatirlatmalar: hatM.get(r.kod) ?? [],
  }));

  // adaylar: aktif temsilciler (izindeki hariç), canlı puan, çakışan izin, bu izinle üstüne binen
  const tem = await db.$queryRaw<{
    id: bigint; ad: string; ekip: string | null; puan: number; cari_sayisi: number;
    ib: Date | null; ie: Date | null;
  }[]>`
    select t.id, t.ad, t.ekip, coalesce(tp.puan,0) as puan, coalesce(tp.cari_sayisi,0) as cari_sayisi,
           (select i.baslangic from portfoy.izin i where i.temsilci_id = t.id and not i.iptal
              and i.baslangic <= ${izin.bitis}::date and i.bitis >= ${izin.baslangic}::date
              order by i.baslangic limit 1) as ib,
           (select i.bitis from portfoy.izin i where i.temsilci_id = t.id and not i.iptal
              and i.baslangic <= ${izin.bitis}::date and i.bitis >= ${izin.baslangic}::date
              order by i.baslangic limit 1) as ie
    from portfoy.temsilci t
    left join portfoy.v_temsilci_puan tp on tp.temsilci_id = t.id
    where t.aktif and t.id <> ${izin.temsilci_id}
    order by t.ad`;
  const adaylar: Aday[] = tem.map((t) => {
    const id = Number(t.id);
    const bindirilen = S.filter((s) => s.bakan === id);
    return {
      id, ad: t.ad, ekip: t.ekip, puan: Number(t.puan), cari_sayisi: Number(t.cari_sayisi),
      izinde: t.ib && t.ie ? { baslangic: d10(t.ib), bitis: d10(t.ie),
                               cakisma: cakismaGun(izin.baslangic, izin.bitis, d10(t.ib), d10(t.ie)) } : null,
      eklenen: bindirilen.length, eklenenYuk: bindirilen.reduce((a, s) => a + s.yuk, 0),
    };
  });
  return { izin, satirlar: S, adaylar };
}

export async function devirAyarla(izinId: number, cariKod: string, bakanId: number | null, kullanici: string) {
  const [eski] = await db.$queryRaw<{ ad: string }[]>`
    select t.ad from portfoy.izin_devir d join portfoy.temsilci t on t.id = d.bakan_temsilci_id
    where d.izin_id = ${izinId} and d.cari_kod = ${cariKod}`;
  if (bakanId === null) {
    await db.$executeRaw`delete from portfoy.izin_devir where izin_id = ${izinId} and cari_kod = ${cariKod}`;
  } else {
    await db.$executeRaw`
      insert into portfoy.izin_devir (izin_id, cari_kod, bakan_temsilci_id, guncelleyen)
      values (${izinId}, ${cariKod}, ${bakanId}, ${kullanici})
      on conflict (izin_id, cari_kod) do update
        set bakan_temsilci_id = excluded.bakan_temsilci_id, guncelleyen = excluded.guncelleyen, guncelleme = now()`;
  }
  const [yeni] = bakanId === null ? [null]
    : await db.$queryRaw<{ ad: string }[]>`select ad from portfoy.temsilci where id = ${bakanId}`;
  await logla("izin_devir", cariKod, `izinde bakan (izin #${izinId})`, eski?.ad ?? null, yeni?.ad ?? null, kullanici);
}

/** Sırayla ilk uygun yedeğe (kendisi izinde olmayan); hiçbiri uygun değilse dokunmaz. */
export async function otomatikAta(izinId: number, kullanici: string) {
  const t = await tahta(izinId);
  if (!t) throw new Error("İzin bulunamadı.");
  const uygun = (id: number | undefined) => id !== undefined && t.adaylar.some((a) => a.id === id && !a.izinde);
  let atanan = 0;
  for (const s of t.satirlar) {
    if (s.bakan !== null) continue;
    const secim = s.yedekler.find((y) => uygun(y.id))?.id ?? null;
    if (secim === null) continue;
    await devirAyarla(izinId, s.kod, secim, kullanici);
    atanan++;
  }
  return atanan;
}

// -------------------------------------------------------------- hatırlatmalar
export async function hatirlatmaEkle(cariKod: string, tarih: string, metin: string,
                                     izinId: number | null, sorumluId: number | null, kullanici: string) {
  const m = metin.trim();
  if (!m) throw new Error("Hatırlatma metni boş olamaz.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) throw new Error("Tarih biçimi hatalı.");
  const [r] = await db.$queryRaw<{ id: bigint }[]>`
    insert into portfoy.hatirlatma (cari_kod, izin_id, sorumlu_temsilci_id, tarih, metin, olusturan)
    values (${cariKod}, ${izinId}, ${sorumluId}, ${tarih}::date, ${m}, ${kullanici}) returning id`;
  await logla("hatirlatma", cariKod, `hatırlatma · ${tarih}`, null, m.slice(0, 120), kullanici);
  return Number(r.id);
}

export async function hatirlatmaDurum(id: number, yapildi: boolean, kullanici: string) {
  const [h] = await db.$queryRaw<{ cari_kod: string; tarih: Date }[]>`
    update portfoy.hatirlatma set yapildi = ${yapildi},
      yapan = case when ${yapildi} then ${kullanici} else null end,
      yapildi_ts = case when ${yapildi} then now() else null end
    where id = ${id} returning cari_kod, tarih`;
  if (!h) throw new Error("Hatırlatma bulunamadı.");
  await logla("hatirlatma", h.cari_kod, `hatırlatma · ${d10(h.tarih)}`, yapildi ? "bekliyor" : "yapıldı", yapildi ? "yapıldı" : "bekliyor", kullanici);
}

export async function hatirlatmaSil(id: number, kullanici: string) {
  const [h] = await db.$queryRaw<{ cari_kod: string; tarih: Date; metin: string }[]>`
    delete from portfoy.hatirlatma where id = ${id} returning cari_kod, tarih, metin`;
  if (!h) throw new Error("Hatırlatma bulunamadı.");
  await logla("hatirlatma", h.cari_kod, `hatırlatma · ${d10(h.tarih)}`, h.metin.slice(0, 120), "silindi", kullanici);
}

export async function hatirlatmalar(): Promise<Hatirlatma[]> {
  const rows = await db.$queryRaw<{
    id: bigint; cari_kod: string; cari_ad: string; tarih: Date; metin: string;
    sorumlu: string | null; izin: string | null; olusturan: string | null; yapildi: boolean; yapan: string | null;
  }[]>`
    select h.id, h.cari_kod, c.ad as cari_ad, h.tarih, h.metin,
           coalesce(ts.ad, (select tb.ad from portfoy.izin_devir d join portfoy.temsilci tb on tb.id = d.bakan_temsilci_id
                              where d.izin_id = h.izin_id and d.cari_kod = h.cari_kod)) as sorumlu,
           (select ti.ad || ' · ' || to_char(i.baslangic,'DD.MM') || '–' || to_char(i.bitis,'DD.MM')
              from portfoy.izin i join portfoy.temsilci ti on ti.id = i.temsilci_id where i.id = h.izin_id) as izin,
           h.olusturan, h.yapildi, h.yapan
    from portfoy.hatirlatma h
    join portfoy.cari c on c.kod = h.cari_kod
    left join portfoy.temsilci ts on ts.id = h.sorumlu_temsilci_id
    where not h.yapildi or h.yapildi_ts > now() - interval '14 days'
    order by h.yapildi, h.tarih`;
  const t = bugun();
  return rows.map((r) => ({
    id: Number(r.id), cari_kod: r.cari_kod, cari_ad: r.cari_ad, tarih: d10(r.tarih), metin: r.metin,
    sorumlu: r.sorumlu, izin: r.izin, olusturan: r.olusturan, yapildi: r.yapildi, yapan: r.yapan,
    gecikme: gunFarki(t, d10(r.tarih)),
  }));
}

// -------------------------------------------------------------- müşteri kartı için
export type KartIzin = { temsilci: string; bakan: string | null; baslangic: string; bitis: string; durum: IzinDurum };

/** Bu müşterinin temsilcisi şu an / yakında izinde mi, kim bakıyor? */
export async function kartIzinleri(kod: string): Promise<KartIzin[]> {
  const rows = await db.$queryRaw<{ temsilci: string; bakan: string | null; baslangic: Date; bitis: Date }[]>`
    select t.ad as temsilci, tb.ad as bakan, i.baslangic, i.bitis
    from portfoy.izin i
    join portfoy.temsilci t on t.id = i.temsilci_id
    join portfoy.portfoy p on p.temsilci_id = i.temsilci_id and p.cari_kod = ${kod}
    left join portfoy.izin_devir d on d.izin_id = i.id and d.cari_kod = ${kod}
    left join portfoy.temsilci tb on tb.id = d.bakan_temsilci_id
    where not i.iptal and i.bitis >= current_date
    order by i.baslangic`;
  return rows.map((r) => ({ temsilci: r.temsilci, bakan: r.bakan, baslangic: d10(r.baslangic), bitis: d10(r.bitis),
                            durum: durumHesapla(d10(r.baslangic), d10(r.bitis)).durum }));
}

// -------------------------------------------------------------- ortak
async function logla(tablo: string, kod: string, alan: string,
                     eski: string | null, yeni: string | null, kullanici: string) {
  await db.$executeRaw`
    insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
    values (${tablo}, ${kod}, ${alan}, ${eski}, ${yeni}, ${kullanici})`;
}
