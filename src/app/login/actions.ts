"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export async function loginAction(_prev: unknown, formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Kullanıcı adı ve şifre gerekli." };
  }

  const res = await login(username, password);
  if (!res.ok) {
    return { error: res.error };
  }
  redirect("/sec");
}
