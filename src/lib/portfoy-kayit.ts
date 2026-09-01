import "server-only";
import { Prisma } from "@prisma/client";
import { ALANLAR } from "./portfoy";

/**
 * Portalın tam durumunu veritabanına yazar.
 *
 * Portal isimlerle çalışır (temsilci adı, ek iş türü adı); veritabanı
 * kimliklerle. Eşleme burada yapılır, portal tarafı sade kalır.
 *
 * Yazılan her şey Supabase'deki `portfoy` şemasındadır ve kalıcıdır.
 * Hesap yapılmaz — puanlar view'lerden okunur.
 */

export type TamKayit = {
  cari?: {
    k: string;
    sg?: string | null; on?: number | string | null; mz?: number | string | null;
    st?: string | null; ko?: string | null; ek?: string | null; pt?: string | null;
    et?: string | null; an?: string | null;
    t?: string | null;                       // tek temsilci adı
    sp?: { t: string; pct: number }[];       // bölüşüm
    zek?: string[];                          // zorunlu ek iş adları
  }[];
  ekip?: Record<string, string>;             // temsilci adı -> YD | YI
  unvan?: Record<string, string>;            // temsilci adı -> 1 | 2 | 3
  zekl?: { ad: string; kat: number }[];      // zorunlu ek iş türleri
  gont?: { ad: string; p: number }[];        // gönüllü ek iş türleri
  gon?: { ad: string; t: string; ac?: string; p: number }[]; // gönüllü kayıtlar
  ag?: Record<string, number>;               // wsv, wnl, wgm, olcek, us, kat
  kat?: Record<string, Record<string, number>>; // katsayı tablosu
};

const PARAMETRELER = ["wsv", "wnl", "wgm", "olcek", "us", "kat"];
const KATSAYI_GRUPLARI = ["kanal", "sg", "on", "mz", "st", "ko", "ek", "pt", "et", "an"];

/** Alan değeri izinli mi; boşsa null döner. */
function alan(a: keyof typeof ALANLAR, v: unknown): string | null {
  const d = v === null || v === undefined ? "" : String(v).trim();
  if (d === "") return null;
  if (!(ALANLAR[a] as readonly string[]).includes(d)) {
    throw new Error(`Geçersiz değer: ${a} = ${d}`);
  }
  return d;
}

type Tx = Prisma.TransactionClient;

export async function tamKayit(tx: Tx, veri: TamKayit, kullanici: string, tamYetki: boolean) {
  const sayac = { cari: 0, atama: 0, zorunlu: 0, gonullu: 0, temsilci: 0, katsayi: 0 };

  // ---------- temsilci adları -> id (eksikler oluşturulur) ----------
  const temsilciAdlari = new Set<string>();
  for (const c of veri.cari ?? []) {
    if (c.t) temsilciAdlari.add(c.t);
    for (const s of c.sp ?? []) if (s.t) temsilciAdlari.add(s.t);
  }
  for (const a of Object.keys(veri.ekip ?? {})) temsilciAdlari.add(a);
  for (const a of Object.keys(veri.unvan ?? {})) temsilciAdlari.add(a);
  for (const g of veri.gon ?? []) if (g.t) temsilciAdlari.add(g.t);
  temsilciAdlari.delete("(atanmamış)");
  temsilciAdlari.delete("");

  for (const ad of temsilciAdlari) {
    await tx.$executeRaw`
      insert into portfoy.temsilci (ad) values (${ad}) on conflict (ad) do nothing`;
  }
  const tRows = await tx.$queryRaw<{ id: bigint; ad: string }[]>`
    select id, ad from portfoy.temsilci`;
  const tid = new Map(tRows.map((r) => [r.ad, Number(r.id)]));

  // ---------- ekip / unvan ----------
  for (const [ad, ek] of Object.entries(veri.ekip ?? {})) {
    const id = tid.get(ad);
    if (!id) continue;
    const e = ek === "YD" || ek === "YI" ? ek : null;
    await tx.$executeRaw`update portfoy.temsilci set ekip=${e} where id=${id}`;
    sayac.temsilci++;
  }
  for (const [ad, un] of Object.entries(veri.unvan ?? {})) {
    const id = tid.get(ad);
    if (!id) continue;
    const u = ["1", "2", "3"].includes(String(un)) ? Number(un) : null;
    await tx.$executeRaw`update portfoy.temsilci set unvan=${u} where id=${id}`;
  }

  // ---------- ek iş türleri (isimle eşlenir, eksikler eklenir) ----------
  for (const t of veri.zekl ?? []) {
    if (!t?.ad) continue;
    await tx.$executeRaw`
      insert into portfoy.zorunlu_tur (ad, katsayi) values (${t.ad}, ${Number(t.kat) || 0})
      on conflict (ad) do update set katsayi = excluded.katsayi`;
  }
  for (const t of veri.gont ?? []) {
    if (!t?.ad) continue;
    await tx.$executeRaw`
      insert into portfoy.gonullu_tur (ad, puan) values (${t.ad}, ${Number(t.p) || 0})
      on conflict (ad) do update set puan = excluded.puan`;
  }
  const zRows = await tx.$queryRaw<{ id: bigint; ad: string }[]>`
    select id, ad from portfoy.zorunlu_tur`;
  const zid = new Map(zRows.map((r) => [r.ad, Number(r.id)]));
  const gRows = await tx.$queryRaw<{ id: bigint; ad: string }[]>`
    select id, ad from portfoy.gonullu_tur`;
  const gid = new Map(gRows.map((r) => [r.ad, Number(r.id)]));

  // ---------- cariler: sınıflandırma + atama + zorunlu ek işler ----------
  //
  // TOPLU YAZMA. Eskiden her cari icin ayri sorgu atiliyordu: 336 cari x ~5
  // sorgu = 1500+ gidis-donus. Prisma'nin varsayilan islem suresi 5 saniye;
  // Supabase'e bu kadar sorgu yetismiyor ve "Transaction not found" hatasi
  // aliniyordu. Simdi hepsi birkac ifadede yapiliyor.
  const cariler = (veri.cari ?? []).filter((c) => c?.k);
  if (cariler.length) {
    // Degerler metin olarak gonderilip SET icinde donusturuluyor; boylece
    // bir kolonun tamami NULL oldugunda Postgres tip cikaramama sorunu olmuyor.
    const bos = (v: string | null) => v ?? "";
    const satirlar = cariler.map((c) => Prisma.sql`(${c.k}, ${bos(alan("segment", c.sg))},
      ${bos(alan("onem", c.on))}, ${bos(alan("zorluk", c.mz))},
      ${bos(alan("siparis_tipi", c.st))}, ${bos(alan("kim_oduyor", c.ko))},
      ${bos(alan("ekipman", c.ek))}, ${bos(alan("portal", c.pt))},
      ${bos(alan("etiket", c.et))}, ${bos(alan("asn", c.an))})`);

    await tx.$executeRaw`
      update portfoy.cari c set
        segment      = nullif(v.segment, ''),
        onem         = nullif(v.onem, '')::smallint,
        zorluk       = nullif(v.zorluk, '')::smallint,
        siparis_tipi = nullif(v.siparis_tipi, ''),
        kim_oduyor   = nullif(v.kim_oduyor, ''),
        ekipman      = nullif(v.ekipman, ''),
        portal       = nullif(v.portal, ''),
        etiket       = nullif(v.etiket, ''),
        asn          = nullif(v.asn, ''),
        guncelleme   = now()
      from (values ${Prisma.join(satirlar)}) as v(kod, segment, onem, zorluk,
             siparis_tipi, kim_oduyor, ekipman, portal, etiket, asn)
      where c.kod = v.kod`;
    sayac.cari = cariler.length;

    const kodlar = cariler.map((c) => c.k);

    // ---- atama: once temizle, sonra toplu yaz ----
    const paySatir: ReturnType<typeof Prisma.sql>[] = [];
    for (const c of cariler) {
      const paylar = (c.sp ?? []).filter((s) => s?.t && Number(s.pct) > 0);
      if (paylar.length) {
        for (const s of paylar) {
          const id = tid.get(s.t);
          if (id) { paySatir.push(Prisma.sql`(${c.k}, ${id}, ${Number(s.pct)})`); sayac.atama++; }
        }
      } else if (c.t && c.t !== "(atanmamış)") {
        const id = tid.get(c.t);
        if (id) { paySatir.push(Prisma.sql`(${c.k}, ${id}, ${100})`); sayac.atama++; }
      }
    }
    await tx.$executeRaw`
      delete from portfoy.portfoy where cari_kod in (${Prisma.join(kodlar)})`;
    if (paySatir.length) {
      await tx.$executeRaw`
        insert into portfoy.portfoy (cari_kod, temsilci_id, pay)
        values ${Prisma.join(paySatir)}
        on conflict (cari_kod, temsilci_id) do update set pay = excluded.pay`;
    }

    // ---- zorunlu ek isler ----
    const zekSatir: ReturnType<typeof Prisma.sql>[] = [];
    for (const c of cariler) {
      for (const ad of c.zek ?? []) {
        const id = zid.get(ad);
        if (id) { zekSatir.push(Prisma.sql`(${c.k}, ${id})`); sayac.zorunlu++; }
      }
    }
    await tx.$executeRaw`
      delete from portfoy.cari_zorunlu where cari_kod in (${Prisma.join(kodlar)})`;
    if (zekSatir.length) {
      await tx.$executeRaw`
        insert into portfoy.cari_zorunlu (cari_kod, zorunlu_tur_id)
        values ${Prisma.join(zekSatir)} on conflict do nothing`;
    }
  }

  // ---------- gönüllü ek iş kayıtları (tamamı yenilenir) ----------
  if (veri.gon) {
    await tx.$executeRaw`delete from portfoy.gonullu_kayit`;
    for (const g of veri.gon) {
      const gt = gid.get(g.ad);
      const t = tid.get(g.t);
      if (!t) continue;
      await tx.$executeRaw`
        insert into portfoy.gonullu_kayit (gonullu_tur_id, temsilci_id, aciklama, puan)
        values (${gt ?? null}, ${t}, ${String(g.ac ?? "")}, ${Number(g.p) || 0})`;
      sayac.gonullu++;
    }
  }

  // ---------- katsayı ve parametreler: yalnız müdür ----------
  if (veri.kat || veri.ag) {
    if (!tamYetki) throw new Error("Katsayı ve parametreleri yalnız müdür değiştirebilir.");
  }
  for (const [grup, m] of Object.entries(veri.kat ?? {})) {
    if (!KATSAYI_GRUPLARI.includes(grup)) continue;
    for (const [anahtar, deger] of Object.entries(m)) {
      await tx.$executeRaw`
        insert into portfoy.katsayi (grup, anahtar, deger)
        values (${grup}, ${String(anahtar)}, ${Number(deger) || 0})
        on conflict (grup, anahtar) do update set deger = excluded.deger`;
      sayac.katsayi++;
    }
  }
  for (const [anahtar, deger] of Object.entries(veri.ag ?? {})) {
    if (!PARAMETRELER.includes(anahtar)) continue;
    await tx.$executeRaw`
      insert into portfoy.parametre (anahtar, deger, guncelleyen, guncelleme)
      values (${anahtar}, to_jsonb(${Number(deger)}::numeric), ${kullanici}, now())
      on conflict (anahtar) do update
        set deger = excluded.deger, guncelleyen = excluded.guncelleyen, guncelleme = now()`;
  }

  await tx.$executeRaw`
    insert into portfoy.degisiklik_log (tablo, kayit_id, alan, yeni, kullanici)
    values ('(tam kayit)', '-', 'kaydet',
            ${`${sayac.cari} cari · ${sayac.atama} atama · ${sayac.zorunlu} zorunlu · ` +
              `${sayac.gonullu} gönüllü · ${sayac.katsayi} katsayı`},
            ${kullanici})`;

  return sayac;
}
