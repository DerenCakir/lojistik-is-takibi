import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALANLAR, gecerliAlan, jsonCevap, portfoyYetki, yazabilir } from "@/lib/portfoy";
import { tamKayit, type TamKayit } from "@/lib/portfoy-kayit";

export const dynamic = "force-dynamic";

/**
 * POST /api/portfoy/kaydet
 *
 * Portalın tüm yazma işlemleri buradan geçer. Gövde:
 *   { islemler: [ {tip: "...", ...}, ... ] }
 *
 * Hepsi tek işlemde (transaction) uygulanır — yarım kalmaz.
 * Yazılan yer Supabase'deki `portfoy` şemasıdır; değişiklik kalıcıdır ve
 * hesap view'leri bir sonraki okumada yeni değerleri döner.
 */

type CariSatir = {
  kod: string; segment?: string | null; onem?: number | null; zorluk?: number | null;
  siparis_tipi?: string | null; kim_oduyor?: string | null; ekipman?: string | null;
  portal?: string | null; etiket?: string | null; asn?: string | null;
};

type Islem =
  | { tip: "cari_alan"; kod: string; alan: string; deger: string }
  | { tip: "cari_toplu"; satirlar: CariSatir[] }
  | { tip: "katsayi_toplu"; satirlar: { grup: string; anahtar: string; deger: number }[] }
  | { tip: "cari_zorunlu"; kod: string; turIdler: number[] }
  | { tip: "portfoy_ata"; kod: string; paylar: { temsilci_id: number; pay: number }[] }
  | { tip: "katsayi"; grup: string; anahtar: string; deger: number }
  | { tip: "parametre"; anahtar: string; deger: number | string }
  | { tip: "temsilci_bilgi"; id: number; ekip: string | null; unvan: number | null }
  | { tip: "gonullu_ekle"; turId: number; temsilciId: number; aciklama: string; puan: number }
  | { tip: "gonullu_sil"; id: number }
  | ({ tip: "tam_kayit" } & TamKayit);

const KATSAYI_GRUPLARI = ["kanal", "sg", "on", "mz", "st", "ko", "ek", "pt", "et", "an"];
const PARAMETRELER = ["wsv", "wnl", "wgm", "olcek", "us", "kat"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ hata: "Oturum yok." }, { status: 401 });

  const yetki = portfoyYetki(user);
  if (!yazabilir(yetki)) {
    return NextResponse.json({ hata: "Yazma yetkiniz yok." }, { status: 403 });
  }
  const tamYetki = yetki === "duzenle_tumu";

  let islemler: Islem[];
  try {
    const gövde = await req.json();
    islemler = Array.isArray(gövde?.islemler) ? gövde.islemler : [];
  } catch {
    return NextResponse.json({ hata: "Gövde okunamadı." }, { status: 400 });
  }
  if (!islemler.length) return NextResponse.json({ ok: true, uygulanan: 0 });
  if (islemler.length > 2000) {
    return NextResponse.json({ hata: "Çok fazla işlem." }, { status: 400 });
  }

  let sonuc: Record<string, number> | null = null;
  try {
    // Toplu yazmaya gecilse de aglar yavas olabilir; varsayilan 5 sn kisa.
    await db.$transaction(async (tx) => {
      for (const i of islemler) {
        switch (i.tip) {
          case "cari_alan": {
            if (!gecerliAlan(i.alan)) throw new Error(`Bilinmeyen alan: ${i.alan}`);
            const izin = ALANLAR[i.alan] as readonly string[];
            const d = String(i.deger ?? "").trim();
            if (d !== "" && !izin.includes(d)) throw new Error(`Geçersiz değer: ${i.alan}=${d}`);
            const v = d === "" ? null : d;
            const n = d === "" ? null : Number(d);
            // Kolon adları sabit; kullanıcı girdisinden gelmez.
            if (i.alan === "segment")
              await tx.$executeRaw`update portfoy.cari set segment=${v}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "onem")
              await tx.$executeRaw`update portfoy.cari set onem=${n}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "zorluk")
              await tx.$executeRaw`update portfoy.cari set zorluk=${n}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "siparis_tipi")
              await tx.$executeRaw`update portfoy.cari set siparis_tipi=${v}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "kim_oduyor")
              await tx.$executeRaw`update portfoy.cari set kim_oduyor=${v}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "ekipman")
              await tx.$executeRaw`update portfoy.cari set ekipman=${v}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "portal")
              await tx.$executeRaw`update portfoy.cari set portal=${v}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "etiket")
              await tx.$executeRaw`update portfoy.cari set etiket=${v}, guncelleme=now() where kod=${i.kod}`;
            else if (i.alan === "asn")
              await tx.$executeRaw`update portfoy.cari set asn=${v}, guncelleme=now() where kod=${i.kod}`;
            await tx.$executeRaw`
              insert into portfoy.degisiklik_log (tablo,kayit_id,alan,yeni,kullanici)
              values ('cari',${i.kod},${i.alan},${v},${user.username})`;
            break;
          }

          case "cari_toplu": {
            // Portalin "Kaydet" dugmesi tum siniflandirmayi bir kerede gonderir.
            for (const r of i.satirlar ?? []) {
              if (!r?.kod) continue;
              const g = (a: keyof typeof ALANLAR, v: unknown) => {
                const d = v === null || v === undefined ? "" : String(v).trim();
                if (d === "") return null;
                if (!(ALANLAR[a] as readonly string[]).includes(d))
                  throw new Error(`Geçersiz değer: ${a}=${d}`);
                return d;
              };
              const onem = g("onem", r.onem);
              const zorluk = g("zorluk", r.zorluk);
              await tx.$executeRaw`
                update portfoy.cari set
                  segment      = ${g("segment", r.segment)},
                  onem         = ${onem === null ? null : Number(onem)},
                  zorluk       = ${zorluk === null ? null : Number(zorluk)},
                  siparis_tipi = ${g("siparis_tipi", r.siparis_tipi)},
                  kim_oduyor   = ${g("kim_oduyor", r.kim_oduyor)},
                  ekipman      = ${g("ekipman", r.ekipman)},
                  portal       = ${g("portal", r.portal)},
                  etiket       = ${g("etiket", r.etiket)},
                  asn          = ${g("asn", r.asn)},
                  guncelleme   = now()
                where kod = ${r.kod}`;
            }
            await tx.$executeRaw`
              insert into portfoy.degisiklik_log (tablo,kayit_id,alan,yeni,kullanici)
              values ('cari','(toplu)','siniflandirma',
                      ${String((i.satirlar ?? []).length) + ' cari'}, ${user.username})`;
            break;
          }

          case "katsayi_toplu": {
            if (!tamYetki) throw new Error("Katsayıları yalnız müdür değiştirebilir.");
            for (const r of i.satirlar ?? []) {
              if (!KATSAYI_GRUPLARI.includes(r.grup)) throw new Error(`Bilinmeyen grup: ${r.grup}`);
              await tx.$executeRaw`
                insert into portfoy.katsayi (grup, anahtar, deger)
                values (${r.grup}, ${String(r.anahtar)}, ${Number(r.deger)})
                on conflict (grup, anahtar) do update set deger=excluded.deger`;
            }
            break;
          }

          case "tam_kayit": {
            // Portalin "Kaydet" dugmesi tum durumu bir kerede gonderir:
            // siniflandirma + atama + bolusum + ek isler + katsayi + parametre.
            const sayac = await tamKayit(tx, i, user.username, tamYetki);
            sonuc = sayac;
            break;
          }

          case "cari_zorunlu": {
            await tx.$executeRaw`delete from portfoy.cari_zorunlu where cari_kod=${i.kod}`;
            for (const t of i.turIdler ?? []) {
              await tx.$executeRaw`
                insert into portfoy.cari_zorunlu (cari_kod, zorunlu_tur_id)
                values (${i.kod}, ${Number(t)}) on conflict do nothing`;
            }
            await tx.$executeRaw`
              insert into portfoy.degisiklik_log (tablo,kayit_id,alan,yeni,kullanici)
              values ('cari_zorunlu',${i.kod},'zorunlu_ek_is',
                      ${(i.turIdler ?? []).join(",")},${user.username})`;
            break;
          }

          case "portfoy_ata": {
            await tx.$executeRaw`delete from portfoy.portfoy where cari_kod=${i.kod}`;
            for (const p of i.paylar ?? []) {
              if (!p || !p.temsilci_id) continue;
              const pay = Number(p.pay) > 0 ? Number(p.pay) : 100;
              await tx.$executeRaw`
                insert into portfoy.portfoy (cari_kod, temsilci_id, pay)
                values (${i.kod}, ${Number(p.temsilci_id)}, ${pay})
                on conflict (cari_kod, temsilci_id) do update set pay=excluded.pay`;
            }
            await tx.$executeRaw`
              insert into portfoy.degisiklik_log (tablo,kayit_id,alan,yeni,kullanici)
              values ('portfoy',${i.kod},'atama',
                      ${(i.paylar ?? []).map((p) => `${p.temsilci_id}:${p.pay}`).join(" ")},
                      ${user.username})`;
            break;
          }

          case "katsayi": {
            if (!tamYetki) throw new Error("Katsayıları yalnız müdür değiştirebilir.");
            if (!KATSAYI_GRUPLARI.includes(i.grup)) throw new Error(`Bilinmeyen grup: ${i.grup}`);
            await tx.$executeRaw`
              insert into portfoy.katsayi (grup, anahtar, deger)
              values (${i.grup}, ${String(i.anahtar)}, ${Number(i.deger)})
              on conflict (grup, anahtar) do update set deger=excluded.deger`;
            break;
          }

          case "parametre": {
            if (!tamYetki) throw new Error("Parametreleri yalnız müdür değiştirebilir.");
            if (!PARAMETRELER.includes(i.anahtar)) throw new Error(`Bilinmeyen parametre: ${i.anahtar}`);
            await tx.$executeRaw`
              insert into portfoy.parametre (anahtar, deger, guncelleyen, guncelleme)
              values (${i.anahtar}, to_jsonb(${Number(i.deger)}::numeric), ${user.username}, now())
              on conflict (anahtar) do update
                set deger=excluded.deger, guncelleyen=excluded.guncelleyen, guncelleme=now()`;
            break;
          }

          case "temsilci_bilgi": {
            const ekip = i.ekip === "YD" || i.ekip === "YI" ? i.ekip : null;
            const unvan = i.unvan && i.unvan >= 1 && i.unvan <= 3 ? Number(i.unvan) : null;
            await tx.$executeRaw`
              update portfoy.temsilci set ekip=${ekip}, unvan=${unvan} where id=${Number(i.id)}`;
            break;
          }

          case "gonullu_ekle": {
            await tx.$executeRaw`
              insert into portfoy.gonullu_kayit (gonullu_tur_id, temsilci_id, aciklama, puan)
              values (${Number(i.turId)}, ${Number(i.temsilciId)},
                      ${String(i.aciklama ?? "")}, ${Number(i.puan) || 0})`;
            break;
          }

          case "gonullu_sil": {
            await tx.$executeRaw`delete from portfoy.gonullu_kayit where id=${Number(i.id)}`;
            break;
          }

          default:
            throw new Error(`Bilinmeyen işlem: ${(i as { tip?: string }).tip}`);
        }
      }
    }, { timeout: 120000, maxWait: 20000 });
  } catch (e) {
    return NextResponse.json(
      { hata: e instanceof Error ? e.message : "Kaydedilemedi." },
      { status: 400 },
    );
  }

  return jsonCevap({ ok: true, uygulanan: islemler.length, sayac: sonuc });
}
