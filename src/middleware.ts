import { NextResponse, type NextRequest } from "next/server";

/**
 * Temsilci hesabı (Portföyüm) İş Takibi portalına girmesin.
 *
 * Middleware veritabanına erişemez; rolü /api/portfoy/rol ucundan bir kez
 * sorar ve "pf_rol" çerezine oturum kimliğiyle birlikte yazar
 * ("t:<oturum>" ya da "y:<oturum>"). Oturum değişince çerez eşleşmez,
 * yeniden sorulur — aynı tarayıcıda temsilci çıkıp yönetici girse de karışmaz.
 * Yönetici için hiçbir şey değişmez. İş Takibi dosyalarına dokunulmaz.
 */
const SERBEST = ["/portfoy/portfoyum", "/login", "/api/portfoy/rol", "/_next", "/favicon.ico"];
const OTURUM = "deren_session";

export async function middleware(req: NextRequest) {
  const yol = req.nextUrl.pathname;
  if (SERBEST.some((s) => yol === s || yol.startsWith(s + "/"))) return NextResponse.next();

  const oturum = req.cookies.get(OTURUM)?.value;
  if (!oturum) return NextResponse.next();                 // giriş yok: uygulama kendisi /login'e atar
  const imza = oturum.slice(-16);

  let rol = "";
  const eski = req.cookies.get("pf_rol")?.value ?? "";
  if (eski.endsWith(":" + imza)) rol = eski.split(":")[0];
  else {
    try {
      const r = await fetch(new URL("/api/portfoy/rol", req.url), { headers: { cookie: req.headers.get("cookie") ?? "" } });
      rol = ((await r.json()) as { rol?: string }).rol ?? "";
    } catch { rol = ""; }
  }

  const cevap = rol === "t"
    ? NextResponse.redirect(new URL("/portfoy/portfoyum", req.url))
    : NextResponse.next();
  if (rol && !eski.endsWith(":" + imza)) {
    cevap.cookies.set("pf_rol", `${rol}:${imza}`, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  return cevap;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
