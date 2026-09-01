/**
 * İstemci bileşeninin kullandığı tipler ve seçenek listeleri.
 *
 * `@/lib/portfoy` "server-only" olduğu için istemciden içe aktarılamaz;
 * paylaşılan tanımlar burada durur. Seçenekler `portfoy.katsayi` tablosundaki
 * anahtarlarla aynı olmalı — değiştirirsen orayı da güncelle.
 */

export const ALANLAR = {
  segment: ["Ana Otomotiv", "Tier-1", "Toptancı", "After Market", "Beyaz Eşya",
            "Holding Firması", "GMBH Yan Sanayi", "Kıtalararası Müşteri",
            "POTANSİYEL MÜŞTERİ"],
  onem: ["1", "2", "3", "4"],
  zorluk: ["1", "2", "3", "4"],
  siparis_tipi: ["EDI", "MANUEL"],
  kim_oduyor: ["Müşteri", "NORM CİVATA"],
  ekipman: ["var", "yok"],
  portal: ["Aktif kullanılıyor", "Bazen kullanılıyor", "Hiç kullanılmıyor"],
  etiket: ["var", "yok"],
  asn: ["var", "yok"],
} as const;

export type AlanAdi = keyof typeof ALANLAR;

export type CariSatir = {
  cari_kod: string;
  cari_ad: string;
  kanal: number | null;
  segment: string | null;
  onem: number | null;
  zorluk: number | null;
  siparis_tipi: string | null;
  kim_oduyor: string | null;
  ekipman: string | null;
  portal: string | null;
  etiket: string | null;
  asn: string | null;
  nl: number;
  al: number;
  sv: number;
  gm: number;
  yuk: number;
  bos_hucre: number;
  temsilciler: string | null;
};
