"use client";

import { useState, useTransition } from "react";
import {
  aktifEtAction, devretAction, ekleAction, guncelleAction, pasifeAlAction,
  type Sonuc,
} from "./actions";

export type Satir = {
  id: number; ad: string; ekip: string | null; unvan: number | null;
  aktif: boolean; cari: number; yuk: number; puan: number; gonullu: number;
};

const UNVAN: Record<number, string> = {
  1: "Lojistik Sorumlusu", 2: "Lojistik Uzmanı", 3: "Lojistik Kıdemli Uzmanı",
};
const nf = (n: number, b = 1) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: b });

export default function Kadro({ satirlar }: { satirlar: Satir[] }) {
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null);
  const [devreden, setDevreden] = useState<Satir | null>(null);
  const [hedef, setHedef] = useState<number | "">("");
  const [bekle, basla] = useTransition();

  const isle = (p: Promise<Sonuc>) => {
    setMesaj(null); setHata(null);
    p.then((s) => {
      if (s.ok) { setMesaj(s.mesaj ?? "Tamam."); setDuzenlenen(null); setDevreden(null); }
      else setHata(s.hata);
      basla(() => {});
    });
  };

  const aktifler = satirlar.filter((s) => s.aktif);
  const ayrilanlar = satirlar.filter((s) => !s.aktif);

  return (
    <>
      {mesaj && <div className="tk-mesaj">{mesaj}</div>}
      {hata && <div className="tk-hata">{hata}</div>}

      <section className="tk-kart">
        <h3>Yeni temsilci</h3>
        <form
          className="tk-form"
          action={(fd) => isle(ekleAction(fd))}
        >
          <input name="ad" placeholder="Ad Soyad" required minLength={3} />
          <select name="ekip" defaultValue="">
            <option value="">Ekip —</option>
            <option value="YI">Yurtiçi</option>
            <option value="YD">Yurtdışı</option>
          </select>
          <select name="unvan" defaultValue="">
            <option value="">Unvan —</option>
            <option value="1">Lojistik Sorumlusu</option>
            <option value="2">Lojistik Uzmanı</option>
            <option value="3">Lojistik Kıdemli Uzmanı</option>
          </select>
          <button className="btn" disabled={bekle}>Ekle</button>
        </form>
        <p className="tk-not">
          Eklenen kişi hemen dağıtım tahtasında ve Ana veri&apos;deki temsilci
          listesinde görünür; müşteri atanana kadar puanı sıfırdır.
        </p>
      </section>

      <section className="tk-kart">
        <h3>Kadro <span className="tk-rozet">{aktifler.length} aktif</span></h3>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Temsilci</th><th>Ekip</th><th>Unvan</th>
              <th className="num">Cari</th><th className="num">Yük</th><th className="num">Puan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {aktifler.map((t) =>
              duzenlenen === t.id ? (
                <tr key={t.id} className="tk-duzenle">
                  <td colSpan={7}>
                    <form className="tk-form" action={(fd) => isle(guncelleAction(fd))}>
                      <input type="hidden" name="id" value={t.id} />
                      <input name="ad" defaultValue={t.ad} required minLength={3} />
                      <select name="ekip" defaultValue={t.ekip ?? ""}>
                        <option value="">Ekip —</option>
                        <option value="YI">Yurtiçi</option>
                        <option value="YD">Yurtdışı</option>
                      </select>
                      <select name="unvan" defaultValue={t.unvan ? String(t.unvan) : ""}>
                        <option value="">Unvan —</option>
                        <option value="1">Lojistik Sorumlusu</option>
                        <option value="2">Lojistik Uzmanı</option>
                        <option value="3">Lojistik Kıdemli Uzmanı</option>
                      </select>
                      <button className="btn" disabled={bekle}>Kaydet</button>
                      <button type="button" className="btn ghost"
                        onClick={() => setDuzenlenen(null)}>Vazgeç</button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td className="pf-name">{t.ad}</td>
                  <td>{t.ekip === "YD" ? "Yurtdışı" : t.ekip === "YI" ? "Yurtiçi" : "—"}</td>
                  <td className="pf-muted">{t.unvan ? UNVAN[t.unvan] : "—"}</td>
                  <td className="num">{nf(t.cari, t.cari % 1 ? 1 : 0)}</td>
                  <td className="num">{nf(t.yuk, 2)}</td>
                  <td className="num pf-strong">{nf(t.puan)}</td>
                  <td className="tk-eylem">
                    <button className="btn ghost" onClick={() => setDuzenlenen(t.id)}>Düzenle</button>
                    {t.cari > 0 ? (
                      <button className="btn ghost" onClick={() => { setDevreden(t); setHedef(""); }}>
                        Portföyü devret
                      </button>
                    ) : (
                      <button className="btn ghost"
                        onClick={() => { if (confirm(`${t.ad} ayrıldı olarak işaretlenecek. Emin misiniz?`)) isle(pasifeAlAction(t.id)); }}>
                        Ayrıldı
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {devreden && (
        <section className="tk-kart tk-devir">
          <h3>{devreden.ad} — portföy devri</h3>
          <p className="tk-not">
            {devreden.cari % 1 ? nf(devreden.cari, 1) : devreden.cari} müşterinin
            tamamı seçtiğiniz kişiye geçer. Bölüşümlü müşterilerde yalnız
            {" "}{devreden.ad} payı taşınır, diğer paydaş korunur.
            Devirden sonra &quot;Ayrıldı&quot; işaretleyebilirsiniz.
          </p>
          <div className="tk-form">
            <select value={hedef} onChange={(e) => setHedef(Number(e.target.value) || "")}>
              <option value="">Kime devredilecek?</option>
              {aktifler.filter((x) => x.id !== devreden.id).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.ad} · {x.cari % 1 ? nf(x.cari, 1) : x.cari} cari · puan {nf(x.puan)}
                </option>
              ))}
            </select>
            <button className="btn" disabled={!hedef || bekle}
              onClick={() => { if (hedef) isle(devretAction(devreden.id, Number(hedef))); }}>
              Devret
            </button>
            <button className="btn ghost" onClick={() => setDevreden(null)}>Vazgeç</button>
          </div>
        </section>
      )}

      {ayrilanlar.length > 0 && (
        <section className="tk-kart">
          <h3>Ayrılanlar <span className="tk-rozet">{ayrilanlar.length}</span></h3>
          <table className="pf-table">
            <tbody>
              {ayrilanlar.map((t) => (
                <tr key={t.id} className="pf-dim">
                  <td className="pf-name">{t.ad}</td>
                  <td className="num">{nf(t.cari, 0)} cari</td>
                  <td className="tk-eylem">
                    <button className="btn ghost" onClick={() => isle(aktifEtAction(t.id))}>
                      Geri al
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tk-not">
            Ayrılanlar silinmez. Geçmiş kayıtlarda adları görünmeye devam eder;
            listelerden ve dağıtım tahtasından çıkarlar.
          </p>
        </section>
      )}
    </>
  );
}
