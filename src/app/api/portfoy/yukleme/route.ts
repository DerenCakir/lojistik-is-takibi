import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonCevap, portfoyYetki } from "@/lib/portfoy";
import { karsilastir, uygula, geriAl, type HamSatir, type Kararlar } from "@/lib/portfoy-yukleme";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/portfoy/yukleme
 *
 * Excel'den gelen hacim verisi için üç işlem:
 *   { islem: "karsilastir", satirlar }            -> önizleme (hiçbir şey yazılmaz)
 *   { islem: "uygula", satirlar, kararlar }       -> onaylananları yazar
 *   { islem: "geri_al", yuklemeId }               -> yükleme öncesine döner
 *
 * Yalnız müdür. Veri yükleme tüm portföyü etkiler.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ hata: "Oturum yok." }, { status: 401 });
  if (portfoyYetki(user) !== "duzenle_tumu") {
    return NextResponse.json(
      { hata: "Veri yükleme yetkisi yalnız müdürdedir." }, { status: 403 });
  }

  let g: { islem?: string; satirlar?: HamSatir[]; kararlar?: Kararlar; yuklemeId?: number };
  try {
    g = await req.json();
  } catch {
    return NextResponse.json({ hata: "Gövde okunamadı." }, { status: 400 });
  }

  const satirlar = Array.isArray(g.satirlar) ? g.satirlar : [];
  if ((g.islem === "karsilastir" || g.islem === "uygula") && !satirlar.length) {
    return NextResponse.json({ hata: "Dosyada okunabilir satır yok." }, { status: 400 });
  }
  if (satirlar.length > 50000) {
    return NextResponse.json({ hata: "Dosya çok büyük (50.000 satır sınırı)." }, { status: 400 });
  }

  try {
    if (g.islem === "karsilastir") {
      return jsonCevap(await karsilastir(satirlar));
    }
    if (g.islem === "uygula") {
      const k = g.kararlar ?? {
        eklenecekCari: [], eklenecekNokta: [], kaldirilacakNokta: [], hacimGuncelle: true,
      };
      return jsonCevap(await uygula(satirlar, k, user.username));
    }
    if (g.islem === "geri_al") {
      if (!g.yuklemeId) return NextResponse.json({ hata: "Yükleme kimliği yok." }, { status: 400 });
      await geriAl(Number(g.yuklemeId), user.username);
      return jsonCevap({ ok: true });
    }
    return NextResponse.json({ hata: "Bilinmeyen işlem." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { hata: e instanceof Error ? e.message : "İşlem başarısız." }, { status: 400 });
  }
}
