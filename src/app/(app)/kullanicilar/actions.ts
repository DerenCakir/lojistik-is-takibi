"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";

// Herkes her şeyi yapabilir — sadece giriş şartı.
async function requireManager() {
  return requireUser();
}

export async function createUser(_prev: unknown, formData: FormData) {
  await requireManager();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "EMPLOYEE") === "MANAGER" ? "MANAGER" : "EMPLOYEE";

  if (!username || !name || !password) return { error: "Tüm alanlar zorunlu." };
  if (password.length < 4) return { error: "Şifre en az 4 karakter olmalı." };
  if (!/^[a-z0-9_.]+$/.test(username)) return { error: "Kullanıcı adı sadece küçük harf, rakam, _ ve . içerebilir." };

  const exists = await db.user.findUnique({ where: { username } });
  if (exists) return { error: "Bu kullanıcı adı zaten kullanılıyor." };

  await db.user.create({ data: { username, name, role, passwordHash: await hashPassword(password) } });
  revalidatePath("/kullanicilar");
  return { ok: true };
}

export async function updateUser(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "EMPLOYEE") === "MANAGER" ? "MANAGER" : "EMPLOYEE";
  if (!id || !name) return;
  await db.user.update({ where: { id }, data: { name, role } });
  revalidatePath("/kullanicilar");
}

export async function toggleUserActive(formData: FormData) {
  const me = await requireManager();
  const id = String(formData.get("id") ?? "");
  if (!id || id === me.id) return; // kendini pasifleştirme
  const u = await db.user.findUnique({ where: { id } });
  if (u) await db.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/kullanicilar");
}

export async function resetPassword(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 4) return;
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  revalidatePath("/kullanicilar");
}
