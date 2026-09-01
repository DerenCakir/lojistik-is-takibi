"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { portfoyYetki } from "@/lib/portfoy";
import {
  aktifEt, ekle, guncelle, pasifeAl, portfoyDevret,
} from "@/lib/portfoy-temsilci";

export type Sonuc = { ok: true; mesaj?: string } | { ok: false; hata: string };

/** Temsilci kadrosunu yalnız müdür değiştirebilir. */
async function mudurGerek() {
  const user = await requireUser();
  if (portfoyYetki(user) !== "duzenle_tumu") {
    throw new Error("Bu işlem yalnız müdür yetkisiyle yapılabilir.");
  }
  return user;
}

function tazele() {
  revalidatePath("/portfoy/temsilciler");
  revalidatePath("/portfoy");
}

export async function ekleAction(fd: FormData): Promise<Sonuc> {
  try {
    const u = await mudurGerek();
    await ekle(String(fd.get("ad") ?? ""), fd.get("ekip"), fd.get("unvan"), u.username);
    tazele();
    return { ok: true, mesaj: "Temsilci eklendi." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Eklenemedi." };
  }
}

export async function guncelleAction(fd: FormData): Promise<Sonuc> {
  try {
    const u = await mudurGerek();
    await guncelle(Number(fd.get("id")), String(fd.get("ad") ?? ""),
                   fd.get("ekip"), fd.get("unvan"), u.username);
    tazele();
    return { ok: true, mesaj: "Kaydedildi." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Kaydedilemedi." };
  }
}

export async function pasifeAlAction(id: number): Promise<Sonuc> {
  try {
    const u = await mudurGerek();
    await pasifeAl(id, u.username);
    tazele();
    return { ok: true, mesaj: "Ayrıldı olarak işaretlendi." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "İşlem başarısız." };
  }
}

export async function aktifEtAction(id: number): Promise<Sonuc> {
  try {
    const u = await mudurGerek();
    await aktifEt(id, u.username);
    tazele();
    return { ok: true, mesaj: "Yeniden aktif." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "İşlem başarısız." };
  }
}

export async function devretAction(kaynakId: number, hedefId: number): Promise<Sonuc> {
  try {
    const u = await mudurGerek();
    const adet = await portfoyDevret(kaynakId, hedefId, u.username);
    tazele();
    return { ok: true, mesaj: `${adet} müşteri devredildi.` };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Devredilemedi." };
  }
}
