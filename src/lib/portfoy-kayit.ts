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
    ak?: string | null;                      // 'Aktif' | 'Pasif'
    t?: string | null;                       // tek temsilci adı
    sp?: { t: string; pct: number }[];       // bölüşüm
    zek?: string[];                          // zorunlu ek iş adları
  }[];
  ekip?: Record<string, string>;             // temsilci adı -> YD | YI
  unvan?: Record<string, string>;            // temsilci adı -> 1 | 2 | 3
  zekl?: { ad: string; kat: number }[];      // zorunlu ek iş türleri
  gont?: { ad: string; p: number }[];        // gönüllü ek iş türleri
  gon?: { ad: string; t: string; ac?: string; p: number }[]; // gönüllü kayıtlar
  pasifNokta?: { k: string; t: string }[];   // pasife alinan mali teslim alanlar
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

  // ---------- değişiklik tespiti ----------
  // Yazmadan önceki hâl okunur; sonra satır satır karşılaştırılıp YALNIZ
  // değişenler loglanır. Özet log ("336 cari kaydedildi") kimin ne zaman
  // kaydettiğini söylüyor ama ne değiştirdiğini söylemiyordu.
  type OncekiCari = {
    kod: string; segment: string | null; onem: number | null; zorluk: number | null;
    siparis_tipi: string | null; kim_oduyor: string | null; ekipman: string | null;
    portal: string | null; etiket: string | null; asn: string | null;
    aktif: boolean;
  };
  const oncekiCari = new Map((await tx.$queryRaw<OncekiCari[]>`
    select kod, segment, onem, zorluk, siparis_tipi, kim_oduyor,
           ekipman, portal, etiket, asn, aktif from portfoy.cari`).map((r) => [r.kod, r]));

  const adaGore = new Map([...tid].map(([ad, id]) => [id, ad]));
  const oncekiPay = new Map<string, string>();
  for (const r of await tx.$queryRaw<{ cari_kod: string; temsilci_id: bigint; pay: unknown }[]>`
      select cari_kod, temsilci_id, pay from portfoy.portfoy order by pay desc, temsilci_id`) {
    const ad = adaGore.get(Number(r.temsilci_id)) ?? "?";
    const p = Number(r.pay);
    const parca = p >= 99.99 ? ad : `${ad} %${Math.round(p)}`;
    oncekiPay.set(r.cari_kod, oncekiPay.has(r.cari_kod)
      ? `${oncekiPay.get(r.cari_kod)} · ${parca}` : parca);
  }

  const zAda = new Map([...zid].map(([ad, id]) => [id, ad]));
  const oncekiZek = new Map<string, string[]>();
  for (const r of await tx.$queryRaw<{ cari_kod: string; zorunlu_tur_id: bigint }[]>`
      select cari_kod, zorunlu_tur_id from portfoy.cari_zorunlu`) {
    const l = oncekiZek.get(r.cari_kod) ?? [];
    l.push(zAda.get(Number(r.zorunlu_tur_id)) ?? "?");
    oncekiZek.set(r.cari_kod, l);
  }

  const kayitlar: ReturnType<typeof Prisma.sql>[] = [];
  const not = (tablo: string, kod: string, alanAd: string,
               eski: string | null, yeni: string | null) => {
    if ((eski ?? "") === (yeni ?? "")) return;
    kayitlar.push(Prisma.sql`(${tablo}, ${kod}, ${alanAd},
                              ${eski || null}, ${yeni || null}, ${kullanici})`);
  };

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
      ${bos(alan("etiket", c.et))}, ${bos(alan("asn", c.an))},
      ${c.ak === "Pasif" ? "f" : "t"})`);

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
        aktif        = (v.aktif = 't'),
        guncelleme   = now()
      from (values ${Prisma.join(satirlar)}) as v(kod, segment, onem, zorluk,
             siparis_tipi, kim_oduyor, ekipman, portal, etiket, asn, aktif)
      where c.kod = v.kod`;
    sayac.cari = cariler.length;

    // ---- neler değişti ----
    const ALAN_AD: Record<string, string> = {
      sg: "segment", on: "önem", mz: "zorluk", st: "sipariş tipi",
      ko: "kim ödüyor", ek: "ekipman", pt: "portal", et: "etiket", an: "ASN",
    };
    for (const c of cariler) {
      const o = oncekiCari.get(c.k);
      if (!o) continue;
      not("cari", c.k, ALAN_AD.sg, o.segment, alan("segment", c.sg));
      not("cari", c.k, ALAN_AD.on, o.onem === null ? null : String(o.onem), alan("onem", c.on));
      not("cari", c.k, ALAN_AD.mz, o.zorluk === null ? null : String(o.zorluk), alan("zorluk", c.mz));
      not("cari", c.k, ALAN_AD.st, o.siparis_tipi, alan("siparis_tipi", c.st));
      not("cari", c.k, ALAN_AD.ko, o.kim_oduyor, alan("kim_oduyor", c.ko));
      not("cari", c.k, ALAN_AD.ek, o.ekipman, alan("ekipman", c.ek));
      not("cari", c.k, ALAN_AD.pt, o.portal, alan("portal", c.pt));
      not("cari", c.k, ALAN_AD.et, o.etiket, alan("etiket", c.et));
      not("cari", c.k, ALAN_AD.an, o.asn, alan("asn", c.an));
      not("cari", c.k, "durum", o.aktif ? "Aktif" : "Pasif",
          c.ak === "Pasif" ? "Pasif" : "Aktif");

      // atama
      const paylar = (c.sp ?? []).filter((s2) => s2?.t && Number(s2.pct) > 0);
      const yeniPay = paylar.length
        ? [...paylar].sort((a, b) => b.pct - a.pct)
            .map((s2) => (s2.pct >= 99.99 ? s2.t : `${s2.t} %${Math.round(s2.pct)}`)).join(" · ")
        : (c.t && c.t !== "(atanmamış)" ? c.t : "");
      not("portfoy", c.k, "temsilci", oncekiPay.get(c.k) ?? "", yeniPay);

      // zorunlu ek işler
      const eskiZ = (oncekiZek.get(c.k) ?? []).slice().sort().join(", ");
      const yeniZ = (c.zek ?? []).slice().sort().join(", ");
      not("cari_zorunlu", c.k, "zorunlu ek iş", eskiZ, yeniZ);
    }

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

  // ---------- malı teslim alan durumu ----------
  // Yalnız pasif olanlar gönderilir; listede olmayan her nokta aktife döner.
  // Böylece bir noktayı geri açmak da tek adımda olur.
  if (veri.pasifNokta) {
    const oncekiPasif = new Set((await tx.$queryRaw<{ cari_kod: string; kod: string }[]>`
      select cari_kod, kod from portfoy.teslim_noktasi where not aktif`)
      .map((r) => `${r.cari_kod}|${r.kod}`));
    const yeniPasif = new Set(veri.pasifNokta.map((n) => `${n.k}|${n.t}`));

    await tx.$executeRaw`update portfoy.teslim_noktasi set aktif = true where not aktif`;
    if (veri.pasifNokta.length) {
      const cift = veri.pasifNokta.map((n) => Prisma.sql`(${n.k}, ${n.t})`);
      await tx.$executeRaw`
        update portfoy.teslim_noktasi t set aktif = false
        from (values ${Prisma.join(cift)}) as v(cari_kod, kod)
        where t.cari_kod = v.cari_kod and t.kod = v.kod`;
    }
    for (const a of yeniPasif) if (!oncekiPasif.has(a)) {
      const [k, t] = a.split("|");
      not("teslim_noktasi", k, `teslim noktası ${t}`, "Aktif", "Pasif");
    }
    for (const a of oncekiPasif) if (!yeniPasif.has(a)) {
      const [k, t] = a.split("|");
      not("teslim_noktasi", k, `teslim noktası ${t}`, "Pasif", "Aktif");
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
            ${kayitlar.length ? `${kayitlar.length} değişiklik` : "değişiklik yok"},
            ${kullanici})`;

  // Alan bazlı kayıtlar — kim, neyi, neden neye çevirdi.
  if (kayitlar.length) {
    for (let i = 0; i < kayitlar.length; i += 500) {
      await tx.$executeRaw`
        insert into portfoy.degisiklik_log (tablo, kayit_id, alan, eski, yeni, kullanici)
        values ${Prisma.join(kayitlar.slice(i, i + 500))}`;
    }
  }

  return { ...sayac, degisiklik: kayitlar.length };
}
