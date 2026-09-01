"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { portfoyYetki, yazabilir } from "@/lib/portfoy";
import {
  aktifEt, ekle, guncelle, pasifeAl, portfoyDevret,
} from "@/lib/portfoy-temsilci";

export type Sonuc = { ok: true; mesaj?: string } | { ok: false; hata: string };

/** Temsilci kadrosunu müdür ve yönetici değiştirebilir; çalışan değiştiremez. */
async function yetkiGerek() {
  const user = await requireUser();
  if (!yazabilir(portfoyYetki(user))) {
    throw new Error("Bu işlem için yazma yetkisi gerekiyor.");
  }
  return user;
}

function tazele() {
  revalidatePath("/portfoy/temsilciler");
  revalidatePath("/portfoy");
}

export async function ekleAction(fd: FormData): Promise<Sonuc> {
  try {
    const u = await yetkiGerek();
    await ekle(String(fd.get("ad") ?? ""), fd.get("ekip"), fd.get("unvan"), u.username);
    tazele();
    return { ok: true, mesaj: "Temsilci eklendi." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Eklenemedi." };
  }
}

export async function guncelleAction(fd: FormData): Promise<Sonuc> {
  try {
    const u = await yetkiGerek();
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
    const u = await yetkiGerek();
    await pasifeAl(id, u.username);
    tazele();
    return { ok: true, mesaj: "Ayrıldı olarak işaretlendi." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "İşlem başarısız." };
  }
}

export async function aktifEtAction(id: number): Promise<Sonuc> {
  try {
    const u = await yetkiGerek();
    await aktifEt(id, u.username);
    tazele();
    return { ok: true, mesaj: "Yeniden aktif." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "İşlem başarısız." };
  }
}

export async function devretAction(kaynakId: number, hedefId: number): Promise<Sonuc> {
  try {
    const u = await yetkiGerek();
    const adet = await portfoyDevret(kaynakId, hedefId, u.username);
    tazele();
    return { ok: true, mesaj: `${adet} müşteri devredildi.` };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Devredilemedi." };
  }
}
