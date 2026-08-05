# Lojistik İş Takibi — Kılavuz

Lojistik iş takip portalı. Çok kullanıcılı, kullanıcı adıyla giriş, iş takibi + takvim/denetim yönetimi.

## Giriş bilgileri (ilk kurulum)

| Rol   | Kullanıcı adı | Şifre |
|-------|---------------|-------|
| Admin (Yönetici) | `deren` | `1234` |

> ⚠️ İlk girişten sonra bu şifreyi **Kullanıcılar** ekranından değiştirin.
> Ekip üyelerini (çalışanları / diğer yöneticileri) yine oradan admin olarak eklersiniz.

## Ne yapabilir?

- **Panel** — Bekleyen/devam eden/tamamlanan iş sayıları, üzerindeki işler, yaklaşan etkinlikler.
- **İşler** — İş oluştur (durum, öncelik, sorumlu, son tarih). Her işin altında:
  - Yapılacaklar (checklist)
  - Tarihli gelişme/not akışı
  - Hızlı durum değiştirme
- **Takvim** — Aylık takvim + yaklaşanlar. Etkinlik (ör. denetim) ekle.
  - Yönetici etkinliğe görev ekler → çalışan tamamlar / yaptığı geliştirmeyi not eder.
- **Kullanıcılar** (yalnız yönetici) — Kişi ekle, rol değiştir, şifre sıfırla, pasifleştir.
- **Tema** — Sol altta Aydınlık / Koyu geçişi.

## Bilgisayarda çalıştırma

Terminalde proje klasöründe:

```bash
npm run dev
```

Sonra tarayıcıdan **http://localhost:3000** adresine gidin.

İlk kurulumda (veya sıfırdan) veritabanını hazırlamak için:

```bash
npm run setup
```

## Teknik özet

- **Next.js 15** (React) — arayüz + sunucu tek projede
- **Prisma + SQLite** — veriler `prisma/dev.db` dosyasında
- **Giriş:** kullanıcı adı + şifre, güvenli oturum çerezi (şifreler `bcrypt` ile saklanır)
- **Tasarım:** Sade & Modern, mor vurgulu; aydınlık + koyu tema

## Sonraki adım: İnternete taşıma

Şu an her şey bu bilgisayarda çalışıyor. Ekibin her yerden erişmesi için ücretsiz
servislere (ör. Vercel + Neon PostgreSQL) taşıyacağız. Hazır olduğunda birlikte yapacağız —
kodda gereken tek değişiklik veritabanını SQLite'tan PostgreSQL'e çevirmek.
