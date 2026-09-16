import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { temsilciKimligi } from "@/lib/portfoy";

export const dynamic = "force-dynamic";

/** Middleware için: bu oturum temsilci hesabı mı? (veritabanına yalnız burada bakılır) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ rol: "yok" });
  const t = await temsilciKimligi(user);
  return NextResponse.json({ rol: t ? "t" : "y" });
}
