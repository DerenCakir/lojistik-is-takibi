"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { temsilciKimligi } from "@/lib/portfoy";
import {
  benimMusterilerim, yedegiOldugum, musteriDetay, benimNotEkle, benimNotGecersiz,
  benimYedekEkle, benimYedekSil, benimYedekSira, degerlendir, hatirlatmalarim, hatirlatmamYapildi,
  type BenimMusterim, type YedegiOldugum, type MusteriDetay, type Hatirlatmam, type Durum,
} from "@/lib/portfoy-portfoyum";

export type Sonuc<T = undefined> = { ok: true; veri: T; mesaj?: string } | { ok: false; hata: string };

/** Her eylem temsilci kimliğiyle başlar; kimlik yoksa hiçbir şey döndürmez. */
async function benKimim() {
  const user = await requireUser();
  const id = await temsilciKimligi(user);
  if (!id) throw new Error("Bu sayfa yalnız temsilci hesapları içindir.");
  return { user, id };
}
const tazele = () => revalidatePath("/portfoy/portfoyum");
const hata = (e: unknown, v: string) => ({ ok: false as const, hata: e instanceof Error ? e.message : v });

export async function detayAction(kod: string): Promise<Sonuc<MusteriDetay | null>> {
  try { const { id } = await benKimim(); return { ok: true, veri: await musteriDetay(id, kod) }; }
  catch (e) { return hata(e, "Okunamadı."); }
}
export async function listelerAction(): Promise<Sonuc<{ benim: BenimMusterim[]; yedek: YedegiOldugum[]; hat: Hatirlatmam[] }>> {
  try { const { id } = await benKimim();
        const [benim, yedek, hat] = await Promise.all([benimMusterilerim(id), yedegiOldugum(id), hatirlatmalarim(id)]);
        return { ok: true, veri: { benim, yedek, hat } }; }
  catch (e) { return hata(e, "Okunamadı."); }
}
export async function notEkleAction(kod: string, turId: number | null, metin: string): Promise<Sonuc<MusteriDetay | null>> {
  try { const { user, id } = await benKimim(); await benimNotEkle(id, kod, turId, metin, user.username); tazele();
        return { ok: true, veri: await musteriDetay(id, kod), mesaj: "Not kaydedildi." }; }
  catch (e) { return hata(e, "Not kaydedilemedi."); }
}
export async function notGecersizAction(kod: string, notId: number, gecerli: boolean): Promise<Sonuc<MusteriDetay | null>> {
  try { const { user, id } = await benKimim(); await benimNotGecersiz(id, notId, gecerli, user.username); tazele();
        return { ok: true, veri: await musteriDetay(id, kod) }; }
  catch (e) { return hata(e, "Güncellenemedi."); }
}
export async function yedekEkleAction(kod: string, yedekId: number): Promise<Sonuc<MusteriDetay | null>> {
  try { const { user, id } = await benKimim(); await benimYedekEkle(id, kod, yedekId, user.username); tazele();
        return { ok: true, veri: await musteriDetay(id, kod), mesaj: "Yedek eklendi. Kişi kendi Portföyüm sayfasında görecek." }; }
  catch (e) { return hata(e, "Yedek eklenemedi."); }
}
export async function yedekSilAction(kod: string, yedekId: number): Promise<Sonuc<MusteriDetay | null>> {
  try { const { user, id } = await benKimim(); await benimYedekSil(id, kod, yedekId, user.username); tazele();
        return { ok: true, veri: await musteriDetay(id, kod), mesaj: "Yedek çıkarıldı." }; }
  catch (e) { return hata(e, "Çıkarılamadı."); }
}
export async function yedekSiraAction(kod: string, yedekId: number, yon: "yukari" | "asagi"): Promise<Sonuc<MusteriDetay | null>> {
  try { const { user, id } = await benKimim(); await benimYedekSira(id, kod, yedekId, yon, user.username); tazele();
        return { ok: true, veri: await musteriDetay(id, kod) }; }
  catch (e) { return hata(e, "Sıra değiştirilemedi."); }
}
export async function degerlendirAction(kod: string, notId: number, durum: Durum): Promise<Sonuc<MusteriDetay | null>> {
  try { const { user, id } = await benKimim(); await degerlendir(id, notId, durum, user.username); tazele();
        return { ok: true, veri: await musteriDetay(id, kod) }; }
  catch (e) { return hata(e, "Kaydedilemedi."); }
}
export async function hatirlatmaYapildiAction(id: number, yapildi: boolean): Promise<Sonuc<Hatirlatmam[]>> {
  try { const { user, id: ben } = await benKimim(); await hatirlatmamYapildi(ben, id, yapildi, user.username); tazele();
        return { ok: true, veri: await hatirlatmalarim(ben) }; }
  catch (e) { return hata(e, "Güncellenemedi."); }
}
