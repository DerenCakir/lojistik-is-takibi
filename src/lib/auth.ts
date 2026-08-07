import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE_NAME = "deren_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: string; // MUDUR | YONETICI | CALISAN (eski: MANAGER | EMPLOYEE)
  isAdmin: boolean; // kullanıcı/yetki yönetimi (Deren)
};

export function isMudur(user: { role: string }) {
  return user.role === "MUDUR";
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Kullanıcı adı + şifre ile doğrula, oturum oluştur, çerezi yaz.
export async function login(username: string, password: string) {
  const user = await db.user.findUnique({
    where: { username: username.trim().toLowerCase() },
  });
  if (!user || !user.active) return { ok: false as const, error: "Kullanıcı bulunamadı veya pasif." };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false as const, error: "Kullanıcı adı veya şifre hatalı." };

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId: user.id, expiresAt } });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true as const };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
    jar.delete(COOKIE_NAME);
  }
}

// Geçerli oturumdaki kullanıcıyı döndürür (yoksa null).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;

  return {
    id: session.user.id,
    username: session.user.username,
    name: session.user.name,
    role: session.user.role,
    isAdmin: session.user.isAdmin,
  };
}

// Sayfa/aksiyonların başında çağrılır; giriş yoksa login'e yönlendirir.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Sadece admin (kullanıcı/yetki yönetimi). Değilse ana sayfaya yönlendirir.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
