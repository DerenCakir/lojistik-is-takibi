"use client";

import { useState } from "react";

/**
 * Tek müşteri ekleme formu.
 *
 * Arka planda Excel yüklemesiyle AYNI yolu kullanır: /api/portfoy/yukleme.
 * Formdaki değerler tek satırlık bir "dosya" gibi gönderilir; önce
 * karşılaştırma (var mı?), sonra uygulama. Böylece:
 *   - kod normalizasyonu, doğrulama, "cari + teslim noktası birlikte" kuralı,
 *     geçmiş kaydı ve geri alma yedeği Excel'dekiyle birebir aynı,
 *   - ikinci bir ekleme yolu yok; ileride Excel'den gelen aynı kod
 *     bu kayıtla eşleşir, mükerrer oluşmaz.
 */

type Durum =
  | { tip: "bos" }
  | { tip: "calisiyor"; mesaj: string }
  | { tip: "hata"; mesaj: string }
  | { tip: "tamam"; kod: string; ad: string; nokta: string; yuklemeId: number };

export default function YeniMusteriFormu() {
  const [kod, setKod] = useState("");
  const [ad, setAd] = useState("");
  const [kanal, setKanal] = useState("");
  const [nokta, setNokta] = useState("");
  const [sevkiyat, setSevkiyat] = useState("0");
  const [malzeme, setMalzeme] = useState("0");
  const [durum, setDurum] = useState<Durum>({ tip: "bos" });

  const kodTemiz = kod.trim();
  const noktaKod = nokta.trim() || kodTemiz;       // boşsa cari kodunun aynısı
  const hazir = /^\d{3,12}$/.test(kodTemiz) && ad.trim().length >= 3 && (kanal === "10" || kanal === "20");

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!hazir) return;
    const satir = {
      cari: kodTemiz, teslim: noktaKod, ad: ad.trim(),
      kanal: Number(kanal), sevkiyat: Number(sevkiyat) || 0, malzeme: Number(malzeme) || 0,
    };
    const post = async (govde: unknown) => {
      const r = await fetch("/api/portfoy/yukleme", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.hata || "İşlem başarısız.");
      return j;
    };

    try {
      // 1) var mı? — Excel akışındaki karşılaştırma adımının aynısı
      setDurum({ tip: "calisiyor", mesaj: "Kod kontrol ediliyor…" });
      const k = await post({ islem: "karsilastir", satirlar: [satir] });
      const yeni = (k.yeniCari ?? []).some((c: { kod: string }) => c.kod === kodTemiz);
      if (!yeni) {
        setDurum({ tip: "hata",
          mesaj: `${kodTemiz} kodlu cari zaten kayıtlı. Ana veri sayfasında arayın; ` +
                 `yeni bir teslim noktası eklemek istiyorsanız Veri yükle sayfasını kullanın.` });
        return;
      }

      // 2) ekle — yalnız bu cari ve noktası; başka hiçbir kayda dokunulmaz
      setDurum({ tip: "calisiyor", mesaj: "Ekleniyor…" });
      const u = await post({
        islem: "uygula", satirlar: [satir],
        kararlar: {
          eklenecekCari: [{ kod: kodTemiz, kanal: Number(kanal) }],
          eklenecekNokta: [], kaldirilacakNokta: [],
          hacimGuncelle: false,   // mevcut noktaların hacmine dokunma
        },
      });
      setDurum({ tip: "tamam", kod: kodTemiz, ad: ad.trim(), nokta: noktaKod,
                 yuklemeId: Number(u.yuklemeId) });
      setKod(""); setAd(""); setKanal(""); setNokta("");
      setSevkiyat("0"); setMalzeme("0");
    } catch (err) {
      setDurum({ tip: "hata", mesaj: err instanceof Error ? err.message : "İşlem başarısız." });
    }
  }

  return (
    <form className="ym-form" onSubmit={gonder}>
      <div className="ym-satir">
        <label>
          <span>Cari kodu <b>*</b></span>
          <input value={kod} onChange={(e) => setKod(e.target.value)}
                 placeholder="2000061234" inputMode="numeric" autoFocus />
          <small>SAP'taki ana cari kodu, yalnız rakam. İleride Excel'den gelen veri bu kodla eşleşir.</small>
        </label>
        <label>
          <span>Dağıtım kanalı <b>*</b></span>
          <select value={kanal} onChange={(e) => setKanal(e.target.value)}>
            <option value="">seç…</option>
            <option value="10">10 — Yurtiçi</option>
            <option value="20">20 — Yurtdışı</option>
          </select>
        </label>
      </div>

      <label>
        <span>Müşteri adı <b>*</b></span>
        <input value={ad} onChange={(e) => setAd(e.target.value)}
               placeholder="YENİ MÜŞTERİ SAN. VE TİC. A.Ş." />
      </label>

      <fieldset className="ym-nokta">
        <legend>İlk malı teslim alan</legend>
        <p className="ym-not">
          Her cari en az bir teslim noktasıyla var olur; noktasız cari hacimsiz kalır,
          yükü sıfır çıkar. Boş bırakırsan cari koduyla aynı olur — sistemdeki
          carilerin çoğu böyle.
        </p>
        <div className="ym-satir ym-uc">
          <label>
            <span>Teslim noktası kodu</span>
            <input value={nokta} onChange={(e) => setNokta(e.target.value)}
                   placeholder={kodTemiz || "cari koduyla aynı"} inputMode="numeric" />
            <small>Adı müşteri adıyla aynı olur (Excel'de de tek ad sütunu var).</small>
          </label>
          <label>
            <span>Sevkiyat sayısı</span>
            <input value={sevkiyat} onChange={(e) => setSevkiyat(e.target.value)}
                   inputMode="numeric" />
          </label>
          <label>
            <span>Malzeme kodu sayısı</span>
            <input value={malzeme} onChange={(e) => setMalzeme(e.target.value)}
                   inputMode="numeric" />
          </label>
        </div>
      </fieldset>

      <div className="ym-alt">
        <button className="btn primary" type="submit"
                disabled={!hazir || durum.tip === "calisiyor"}>
          {durum.tip === "calisiyor" ? durum.mesaj : "Müşteriyi ekle"}
        </button>
        <span className="ym-ipucu">
          Yalnız bu cari eklenir. Mevcut hiçbir müşteriye, atamaya veya puana dokunulmaz.
        </span>
      </div>

      {durum.tip === "hata" && <div className="tk-mesaj tk-hata">{durum.mesaj}</div>}
      {durum.tip === "tamam" && (
        <div className="tk-mesaj vy-basarili">
          <b>{durum.ad}</b> ({durum.kod}) eklendi, teslim noktası {durum.nokta}.
          Portalı yenileyince Ana veri'de görünür; sınıflandırmasını ve temsilcisini
          oradan girin. Bu ekleme değişiklik geçmişine işlendi ve Veri yükle sayfasından
          geri alınabilir (yükleme #{durum.yuklemeId}).
        </div>
      )}
    </form>
  );
}
