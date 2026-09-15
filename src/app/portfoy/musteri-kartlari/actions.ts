"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { portfoyYetki, yazabilir } from "@/lib/portfoy";
import {
  kartDetay, notEkle, notGecerlilik, yedekEkle, yedekSil, yedekYetkinlik, yedekSira, turEkle, turGuncelle, turler,
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

export async function yedekEkleAction(kod: string, temsilciId: number): Promise<Sonuc<KartDetay | null>> {
  try { const u = await yetkiGerek(); await yedekEkle(kod, temsilciId, u.username); tazele();
        return { ok: true, veri: await kartDetay(kod), mesaj: "Yedek eklendi." }; }
  catch (e) { return hata(e, "Yedek eklenemedi."); }
}
export async function yedekSilAction(kod: string, temsilciId: number): Promise<Sonuc<KartDetay | null>> {
  try { const u = await yetkiGerek(); await yedekSil(kod, temsilciId, u.username); tazele();
        return { ok: true, veri: await kartDetay(kod), mesaj: "Yedek çıkarıldı." }; }
  catch (e) { return hata(e, "Çıkarılamadı."); }
}
export async function yedekYetkinlikAction(kod: string, temsilciId: number, yetkinlik: string): Promise<Sonuc<KartDetay | null>> {
  try { const u = await yetkiGerek(); await yedekYetkinlik(kod, temsilciId, yetkinlik, u.username); tazele();
        return { ok: true, veri: await kartDetay(kod), mesaj: "Not kaydedildi." }; }
  catch (e) { return hata(e, "Kaydedilemedi."); }
}
export async function yedekSiraAction(kod: string, temsilciId: number, yon: "yukari" | "asagi"): Promise<Sonuc<KartDetay | null>> {
  try { const u = await yetkiGerek(); await yedekSira(kod, temsilciId, yon, u.username); tazele();
        return { ok: true, veri: await kartDetay(kod) }; }
  catch (e) { return hata(e, "Sıra değiştirilemedi."); }
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

/* ======================= izin & devir · hatırlatmalar ======================= */
import {
  izinler, izinEkle, izinIptal, tahta, devirAyarla, otomatikAta,
  hatirlatmaEkle, hatirlatmaDurum, hatirlatmaSil, hatirlatmalar,
  type Izin, type IzinTur, type Tahta, type Hatirlatma,
} from "@/lib/portfoy-izin";

export async function izinlerAction(): Promise<Sonuc<Izin[]>> {
  try { await requireUser(); return { ok: true, veri: await izinler() }; }
  catch (e) { return hata(e, "İzinler okunamadı."); }
}
export async function izinEkleAction(temsilciId: number, baslangic: string, bitis: string,
                                     tur: IzinTur, aciklama: string | null): Promise<Sonuc<Izin[]>> {
  try { const u = await yetkiGerek(); await izinEkle(temsilciId, baslangic, bitis, tur, aciklama, u.username);
        tazele(); return { ok: true, veri: await izinler(), mesaj: "İzin eklendi." }; }
  catch (e) { return hata(e, "İzin eklenemedi."); }
}
export async function izinIptalAction(id: number): Promise<Sonuc<Izin[]>> {
  try { const u = await yetkiGerek(); await izinIptal(id, u.username);
        tazele(); return { ok: true, veri: await izinler(), mesaj: "İzin iptal edildi." }; }
  catch (e) { return hata(e, "İptal edilemedi."); }
}
export async function tahtaAction(izinId: number): Promise<Sonuc<Tahta | null>> {
  try { await requireUser(); return { ok: true, veri: await tahta(izinId) }; }
  catch (e) { return hata(e, "Tahta okunamadı."); }
}
export async function devirAction(izinId: number, cariKod: string, bakanId: number | null): Promise<Sonuc<Tahta | null>> {
  try { const u = await yetkiGerek(); await devirAyarla(izinId, cariKod, bakanId, u.username);
        tazele(); return { ok: true, veri: await tahta(izinId) }; }
  catch (e) { return hata(e, "Kaydedilemedi."); }
}
export async function otomatikAtaAction(izinId: number): Promise<Sonuc<Tahta | null>> {
  try { const u = await yetkiGerek(); const n = await otomatikAta(izinId, u.username);
        tazele(); return { ok: true, veri: await tahta(izinId), mesaj: n ? `${n} müşteri yedeğine atandı.` : "Atanacak uygun yedek bulunamadı." }; }
  catch (e) { return hata(e, "Otomatik atama yapılamadı."); }
}
export async function devirNotuAction(izinId: number, cariKod: string, turId: number | null, metin: string): Promise<Sonuc<Tahta | null>> {
  try { const u = await yetkiGerek(); await notEkle(cariKod, turId, metin, u.username, izinId);
        tazele(); return { ok: true, veri: await tahta(izinId), mesaj: "Devir notu kaydedildi." }; }
  catch (e) { return hata(e, "Not kaydedilemedi."); }
}
export async function hatirlatmaEkleAction(cariKod: string, tarih: string, metin: string,
                                           izinId: number | null, sorumluId: number | null): Promise<Sonuc<undefined>> {
  try { const u = await yetkiGerek(); await hatirlatmaEkle(cariKod, tarih, metin, izinId, sorumluId, u.username);
        tazele(); return { ok: true, veri: undefined, mesaj: "Hatırlatma eklendi." }; }
  catch (e) { return hata(e, "Hatırlatma eklenemedi."); }
}
export async function hatirlatmaDurumAction(id: number, yapildi: boolean): Promise<Sonuc<Hatirlatma[]>> {
  try { const u = await yetkiGerek(); await hatirlatmaDurum(id, yapildi, u.username);
        tazele(); return { ok: true, veri: await hatirlatmalar() }; }
  catch (e) { return hata(e, "Güncellenemedi."); }
}
export async function hatirlatmaSilAction(id: number): Promise<Sonuc<Hatirlatma[]>> {
  try { const u = await yetkiGerek(); await hatirlatmaSil(id, u.username);
        tazele(); return { ok: true, veri: await hatirlatmalar() }; }
  catch (e) { return hata(e, "Silinemedi."); }
}
export async function hatirlatmalarAction(): Promise<Sonuc<Hatirlatma[]>> {
  try { await requireUser(); return { ok: true, veri: await hatirlatmalar() }; }
  catch (e) { return hata(e, "Hatırlatmalar okunamadı."); }
}
