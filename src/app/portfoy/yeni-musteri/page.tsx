import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { portfoyYetki } from "@/lib/portfoy";
import Icon from "@/components/Icon";
import YeniMusteriFormu from "./YeniMusteriFormu";

export const dynamic = "force-dynamic";

/**
 * Tek müşteri ekleme.
 * Excel beklemeden, SAP'ta açılmış bir cariyi portföye almak için.
 * Yalnız müdür — Veri yükle ile aynı yetki, çünkü aynı yolu kullanır.
 */
export default async function YeniMusteriPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (portfoyYetki(user) !== "duzenle_tumu") redirect("/portfoy");

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/portfoy" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portala dön
        </Link>
        <span className="pfp-title">Yeni Müşteri</span>
        <span className="pfp-ara" />
        <Link href="/portfoy/veri-yukle" className="pfp-eylem">
          <Icon name="plus" size={14} /> Toplu yükleme (Excel)
        </Link>
        <span className="pfp-user">{user.name}</span>
      </div>

      <div className="vy-govde">
        <div className="vy-sol">
          <div className="vy-kart">
            <YeniMusteriFormu />
          </div>
        </div>

        <aside className="vy-sag">
          <h3>Ne zaman kullanılır?</h3>
          <p>
            SAP'ta yeni bir cari açıldı ve aylık Excel'i beklemeden portföye
            almak istiyorsun. Birden fazla müşteri ya da toplu hacim güncellemesi
            için <b>Veri yükle</b> sayfası daha uygundur.
          </p>

          <h3>Excel yüklemesinden farkı</h3>
          <p>
            <b>Yok.</b> Bu form, Excel yüklemesinin arka plandaki yolunu tek satırla
            çağırır: aynı kod doğrulaması, aynı "cari + teslim noktası birlikte"
            kuralı, aynı geçmiş kaydı, aynı geri alma yedeği. Excel'le eklenenle
            buradan eklenen veritabanında ayırt edilemez.
          </p>

          <h3>Dikkat</h3>
          <ol className="vy-liste">
            <li>
              <b>Cari kodu SAP'takiyle aynı olmalı.</b> Sonraki Excel yüklemesi
              sevkiyatları bu koda göre eşleştirir; kod farklıysa aynı müşteri
              iki kez oluşur.
            </li>
            <li>
              Sevkiyat ve malzeme sayısı bilinmiyorsa <b>0</b> bırak. Sonraki
              Excel'de gerçek değerler gelince kendiliğinden güncellenir.
            </li>
            <li>
              Eklenen müşteri <b>temsilcisiz ve sınıflandırmasız</b> başlar;
              Ana veri sayfasında görünür, oradan tamamlanır. Sınıflandırma girilene
              kadar yükü sıfıra yakındır.
            </li>
            <li>
              Yanlış eklediysen <b>Veri yükle</b> sayfasındaki son yüklemeyi geri al;
              cari ve noktası kaldırılır.
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
