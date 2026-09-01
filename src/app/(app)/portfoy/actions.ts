"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  cariAlanGuncelle, gecerliAlan, logla, portfoyYetki, yazabilir,
} from "@/lib/portfoy";

export type AlanSonuc = { ok: true } | { ok: false; error: string };

/**
 * Bir carinin tek bir sınıflandırma alanını günceller.
 * Yetki İş Takibi rollerinden gelir; portföyün ayrı kullanıcı listesi yoktur.
 */
export async function alanGuncelleAction(
  kod: string, alan: string, deger: string, eski: string,
): Promise<AlanSonuc> {
  const user = await requireUser();
  if (!yazabilir(portfoyYetki(user))) {
    return { ok: false, error: "Bu alanı değiştirme yetkiniz yok." };
  }
  if (!gecerliAlan(alan)) {
    return { ok: false, error: "Bilinmeyen alan." };
  }
  try {
    await cariAlanGuncelle(kod, alan, deger);
    await logla(kod, alan, eski || null, deger || null, user.username);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Kaydedilemedi." };
  }
  revalidatePath("/portfoy/musteriler");
  revalidatePath("/portfoy");
  return { ok: true };
}
