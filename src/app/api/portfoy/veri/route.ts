import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { anlikVeri, jsonCevap, portfoyYetki, yazabilir } from "@/lib/portfoy";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfoy/veri
 *
 * Portalın tüm veri ihtiyacını tek istekte döner. Veri Supabase'de durur;
 * tarayıcı oraya doğrudan bağlanmaz, bu uç üzerinden geçer — böylece
 * İş Takibi oturumu ikinci bir girişe gerek bırakmaz.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum yok." }, { status: 401 });
  }
  try {
    const veri = await anlikVeri();
    return jsonCevap({
      ...veri,
      kullanici: {
        ad: user.name,
        kullaniciAdi: user.username,
        rol: user.role,
        yetki: portfoyYetki(user),
        yazabilir: yazabilir(portfoyYetki(user)),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { hata: e instanceof Error ? e.message : "Veri okunamadı." },
      { status: 500 },
    );
  }
}
