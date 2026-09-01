import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonCevap, senaryoPuan } from "@/lib/portfoy";

export const dynamic = "force-dynamic";

/**
 * POST /api/portfoy/senaryo
 *
 * Dağıtım tahtasının "kaydetmeden ne olurdu" hesabı.
 * Gövde: { atamalar: [{cari_kod, temsilci_id, pay}] }
 *
 * Hesap veritabanındaki f_senaryo_puan içinde yapılır; gerçek portföy
 * değişmez, yalnız verilen atamalar varsayılarak puanlar döner.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ hata: "Oturum yok." }, { status: 401 });

  try {
    const gövde = await req.json();
    const atamalar = Array.isArray(gövde?.atamalar) ? gövde.atamalar : [];
    if (atamalar.length > 2000) {
      return NextResponse.json({ hata: "Çok fazla atama." }, { status: 400 });
    }
    return jsonCevap({ satirlar: await senaryoPuan(atamalar) });
  } catch (e) {
    return NextResponse.json(
      { hata: e instanceof Error ? e.message : "Hesaplanamadı." },
      { status: 400 },
    );
  }
}
