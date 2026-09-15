"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { portfoyYetki, yazabilir } from "@/lib/portfoy";
import {
  kartDetay, notEkle, notGecerlilik, yedekAyarla, turEkle, turGuncelle, turler,
  type KartDetay, type Tur,
} from "@/lib/portfoy-kart";

export type Sonuc<T = undefined> =
  | { ok: true; veri: T; mesaj?: string }
  | { ok: false; hata: string };

/** Notları ve yedekleri müdür ve yöneticiler yazar; herkes okur. */
async function yetkiGerek() {
  const user = await requireUser();
  if (!yazabilir(portfoyYetki(user))) throw new Error("Bu işlem için yazma yetkisi gerekiyor.");
  return user;
}
const tazele = () => revalidatePath("/portfoy/musteri-kartlari");
const hata = (e: unknown, v: string) => ({ ok: false as const, hata: e instanceof Error ? e.message : v });

export async function detayAction(kod: string): Promise<Sonuc<KartDetay | null>> {
  try {
    await requireUser();
    return { ok: true, veri: await kartDetay(kod) };
  } catch (e) { return hata(e, "Kart okunamadı."); }
}

export async function notEkleAction(kod: string, turId: number | null, metin: string): Promise<Sonuc<KartDetay | null>> {
  try {
    const u = await yetkiGerek();
    await notEkle(kod, turId, metin, u.username);
    tazele();
    return { ok: true, veri: await kartDetay(kod), mesaj: "Not kaydedildi." };
  } catch (e) { return hata(e, "Not kaydedilemedi."); }
}

export async function notGecerlilikAction(kod: string, id: number, gecerli: boolean): Promise<Sonuc<KartDetay | null>> {
  try {
    const u = await yetkiGerek();
    await notGecerlilik(id, gecerli, u.username);
    tazele();
    return { ok: true, veri: await kartDetay(kod) };
  } catch (e) { return hata(e, "Güncellenemedi."); }
}

export async function yedekAction(kod: string, sira: 1 | 2, temsilciId: number | null): Promise<Sonuc<KartDetay | null>> {
  try {
    const u = await yetkiGerek();
    await yedekAyarla(kod, sira, temsilciId, u.username);
    tazele();
    return { ok: true, veri: await kartDetay(kod), mesaj: "Yedek kaydedildi." };
  } catch (e) { return hata(e, "Yedek kaydedilemedi."); }
}

export async function turEkleAction(ad: string, onemli: boolean): Promise<Sonuc<Tur[]>> {
  try {
    const u = await yetkiGerek();
    await turEkle(ad, onemli, u.username);
    tazele();
    return { ok: true, veri: await turler(), mesaj: "Başlık eklendi." };
  } catch (e) { return hata(e, "Başlık eklenemedi."); }
}

export async function turGuncelleAction(id: number, ad: string, onemli: boolean, aktif: boolean): Promise<Sonuc<Tur[]>> {
  try {
    const u = await yetkiGerek();
    await turGuncelle(id, ad, onemli, aktif, u.username);
    tazele();
    return { ok: true, veri: await turler() };
  } catch (e) { return hata(e, "Başlık güncellenemedi."); }
}
