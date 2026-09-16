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

/* ---- temsilci hesabi baglama (Portfoyum girisi) ---- */
import { kullaniciBagla } from "@/lib/portfoy-portfoyum";
export async function kullaniciBaglaAction(fd: FormData): Promise<Sonuc> {
  try {
    const u = await yetkiGerek();
    const ad = String(fd.get("kullanici") ?? "").trim();
    await kullaniciBagla(Number(fd.get("id")), ad || null, u.username);
    tazele();
    return { ok: true, mesaj: ad ? `Hesap bağlandı: ${ad}` : "Hesap bağı kaldırıldı." };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Bağlanamadı." };
  }
}

/* ---- temsilci hesabi AC ve bagla (tek adim) ----
   Hesap, Is Takibi'nin kullanici tablosuna acilir (tek giris korunur);
   acma isini Is Takibi'nin kendi createUser eylemi yapar — sifre kurali,
   kullanici adi kurali, mukerrer kontrolu oradakiyle birebir ayni.
   Yalniz admin (Is Takibi'ndeki kuralla ayni). Sifreyi yonetici belirler. */
import { createUser } from "@/app/(app)/kullanicilar/actions";
export async function hesapAcVeBaglaAction(fd: FormData): Promise<Sonuc> {
  try {
    const u = await requireUser();
    if (!u.isAdmin) return { ok: false, hata: "Hesap açma yetkisi yalnız admin kullanıcıdadır (Kullanıcılar sayfasıyla aynı kural)." };
    const id = Number(fd.get("id"));
    const kullanici = String(fd.get("kullanici") ?? "").trim().toLowerCase();
    const sifre = String(fd.get("sifre") ?? "");
    const sifre2 = String(fd.get("sifre2") ?? "");
    if (sifre !== sifre2) return { ok: false, hata: "Şifreler aynı değil." };
    const [t] = await (await import("@/lib/db")).db.$queryRaw<{ ad: string }[]>`select ad from portfoy.temsilci where id = ${id}`;
    if (!t) return { ok: false, hata: "Temsilci bulunamadı." };

    const f = new FormData();
    f.set("username", kullanici); f.set("name", t.ad); f.set("password", sifre); f.set("role", "CALISAN");
    const r = await createUser(null, f) as { ok?: boolean; error?: string };
    if (r?.error) return { ok: false, hata: r.error };

    await kullaniciBagla(id, kullanici, u.username);
    tazele();
    return { ok: true, mesaj: `${t.ad} için "${kullanici}" hesabı açıldı ve bağlandı. Kişi artık girişte Portföyüm'ü görür.` };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Hesap açılamadı." };
  }
}
