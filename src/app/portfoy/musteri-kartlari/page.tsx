import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { portfoyYetki, yazabilir } from "@/lib/portfoy";
import { temsilciKimligi } from "@/lib/portfoy";
import { kartListesi, temsilciler, turler } from "@/lib/portfoy-kart";
import { izinler, hatirlatmalar } from "@/lib/portfoy-izin";
import Icon from "@/components/Icon";
import Kartlar from "./Kartlar";

export const dynamic = "force-dynamic";

/**
 * Müşteri Kartları — süreç notları ve yedek temsilciler.
 * Herkes okur; müdür ve yöneticiler yazar.
 * Rakamlar ana portalın view'lerinden canlı okunur, kopya tutulmaz.
 */
async function yukle() {
  const [liste, turListesi, temsilciListesi, izinListesi, hatListesi] = await Promise.all([
    kartListesi(), turler(), temsilciler(), izinler(), hatirlatmalar(),
  ]);
  return { liste, turListesi, temsilciListesi, izinListesi, hatListesi };
}

export default async function MusteriKartlariPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await temsilciKimligi(user)) redirect("/portfoy/portfoyum");   // temsilci: yalnız kendi sayfası
  const yazar = yazabilir(portfoyYetki(user));

  // Tablolar Supabase'de henüz yoksa (16/17 SQL çalışmadıysa) çökmek yerine
  // ne yapılacağını söyle. Ana portal bu tablolara bağlı değil, o çalışmaya devam eder.
  let veri: Awaited<ReturnType<typeof yukle>> | null = null;
  let kurulumHatasi: string | null = null;
  try { veri = await yukle(); }
  catch (e) { kurulumHatasi = e instanceof Error ? e.message : String(e); }

  if (!veri) {
    const eksik = /relation "portfoy\.(\w+)" does not exist/.exec(kurulumHatasi ?? "")?.[1];
    return (
      <div className="pfp-wrap">
        <div className="pfp-bar">
          <Link href="/portfoy" className="pfp-back"><Icon name="arrowLeft" size={15} /> Portala dön</Link>
          <span className="pfp-title">Müşteri Kartları</span><span className="pfp-ara" /><span className="pfp-user">{user.name}</span>
        </div>
        <div className="iz-lyt"><div className="iz-kart">
          <h3 style={{ marginTop: 0 }}>Kurulum tamamlanmamış</h3>
          <p>Bu sayfanın kullandığı tablolar veritabanında henüz yok{eksik ? <> (<code>portfoy.{eksik}</code>)</> : null}.
             Supabase &gt; SQL Editor'de sırayla <b>16_musteri_kartlari.sql</b> ve <b>17_izin_devir.sql</b> çalıştırılmalı.
             Ana portal bu tablolara bağlı değildir; olduğu gibi çalışmaya devam eder.</p>
          <details><summary className="kucuk">teknik ayrıntı</summary><pre className="kucuk" style={{ whiteSpace: "pre-wrap" }}>{kurulumHatasi}</pre></details>
        </div></div>
      </div>
    );
  }
  const { liste, turListesi, temsilciListesi, izinListesi, hatListesi } = veri;

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/portfoy" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portala dön
        </Link>
        <span className="pfp-title">Müşteri Kartları</span>
        <span className="pfp-ara" />
        <span className="pfp-user">{user.name}</span>
      </div>
      <Kartlar liste={liste} turler={turListesi} temsilciler={temsilciListesi} yazar={yazar}
               izinler={izinListesi} hatirlatmalar={hatListesi} />
    </div>
  );
}
