import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { portfoyYetki } from "@/lib/portfoy";
import Icon from "@/components/Icon";
import Yukleyici from "./Yukleyici";

export const dynamic = "force-dynamic";

/**
 * Portföy hacim verisi yükleme ekranı.
 * Yalnız müdür — yükleme tüm portföyün puanlarını etkiler.
 */
export default async function VeriYuklePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (portfoyYetki(user) !== "duzenle_tumu") redirect("/portfoy");

  return (
    <div className="pfp-wrap">
      <div className="pfp-bar">
        <Link href="/portfoy" className="pfp-back">
          <Icon name="arrowLeft" size={15} /> Portala dön
        </Link>
        <span className="pfp-title">Veri Yükleme</span>
        <span className="pfp-user">{user.name}</span>
      </div>

      <div className="vy-govde">
        <div className="vy-sol">
          <Yukleyici />
        </div>

        <aside className="vy-sag">
          <h3>Bu alan ne işe yarar?</h3>
          <p>
            Portföydeki <b>sevkiyat sayıları, malzeme kodu sayıları ve malı teslim
            alan listesi</b> buradan güncellenir. Müşterilerin sınıflandırma
            bilgilerine (segment, önem, zorluk…) ve temsilci dağılımına
            <b> dokunulmaz</b>.
          </p>

          <h3>Veriyi güncelleyecek kişi için yönergeler</h3>
          <ol className="vy-liste">
            <li>
              Yüklenecek Excel, <b>2026-Sevkiyatlar</b> dosyasından (Burak Balcı)
              <b> pivot yapılmış</b> olarak, sabit formatta hazırlanmalıdır.
            </li>
            <li>
              Veri <b>yıl başından bugüne kümülatif</b> olmalıdır. Yalnız o ayın
              rakamları yüklenirse sevkiyat sayıları düşer ve puanlar yanlış çıkar.
            </li>
            <li>
              Sütunlar <b>sırayla</b> şöyle olmalıdır:
              <table className="vy-sutun">
                <tbody>
                  <tr><td>1</td><td>Müşteri Ana Cari</td></tr>
                  <tr><td>2</td><td>Malı Teslim Alan</td></tr>
                  <tr><td>3</td><td>Müşteri Adı</td></tr>
                  <tr><td>4</td><td>Dağıtım Kanalı</td></tr>
                  <tr><td>5</td><td>Yapılan Sevkiyat Sayısı</td></tr>
                  <tr><td>6</td><td>Giden malzeme sayısı</td></tr>
                </tbody>
              </table>
              İlk satır başlık satırıdır. Dosya <code>.xlsx</code> olmalıdır.
            </li>
            <li>
              Dosyayı sol taraftaki alana sürükleyin. <b>Hiçbir şey hemen
              kaydedilmez</b> — önce ne değişeceğini gösteren bir rapor çıkar.
            </li>
            <li>
              Raporun başındaki <b>Sütun eşleşmesi</b> bölümünü açıp doğru
              okunduğunu kontrol edin. Sonra eklenecek yeni müşterileri işaretleyin, en alttaki
              <b> Uygula</b> düğmesine basın. Basmadan çıkarsanız hiçbir değişiklik olmaz.
            </li>
          </ol>

          <h3>Nelere dikkat edilmeli</h3>
          <ul className="vy-liste">
            <li>
              <b>Toplam sevkiyat düşüyorsa durun.</b> Kümülatif veride bu olmaz;
              ya yanlış dosya ya eksik pivot demektir. Rapor bunu kırmızı uyarır.
            </li>
            <li>
              <b>Yeni müşteriler tek tek onaylanır.</b> Deneme kayıtları
              (ZDUMMYMUST, ZKANBAN gibi) listede görünür ama işaretsiz gelir —
              işaretlemezseniz eklenmez.
            </li>
            <li>
              Yeni müşterilerin <b>Yurtiçi / Yurtdışı</b> bilgisi dosyadaki Dağıtım
              Kanalı sütunundan gelir (10 = Yurtiçi, 20 = Yurtdışı). Boşsa ekranda
              seçmeniz istenir — bu seçim puanı doğrudan etkiler.
            </li>
            <li>
              <b>#N/A</b> gelen satırlarda mevcut değer korunur, sıfırlanmaz.
            </li>
            <li>
              Dosyada olmayan teslim noktaları <b>silinmez</b>. Silinmesini
              istiyorsanız raporda ayrıca işaretlemeniz gerekir.
            </li>
          </ul>

          <div className="vy-not">
            Her yükleme öncesi mevcut verinin tam kopyası alınır. Yanlış dosya
            yüklerseniz <b>geri alınabilir</b>.
          </div>
        </aside>
      </div>
    </div>
  );
}
