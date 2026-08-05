# İnternete Taşıma (Supabase + Railway)

Sıra: **1) Supabase → 2) Yerelde tabloları oluştur → 3) GitHub → 4) Railway**

---

## 1) Supabase — veritabanı

1. [supabase.com](https://supabase.com) → **New project**. Bölge: `Central EU (Frankfurt)` (Türkiye'ye yakın). Bir **database şifresi** belirle ve not al.
2. Proje açılınca üstteki **Connect** butonuna tıkla → **ORMs → Prisma** sekmesi.
3. Orada iki satır var; bunları kopyala:
   - `DATABASE_URL` (…pooler…**:6543**…)
   - `DIRECT_URL` (…**:5432**…)
   - İçindeki `[YOUR-PASSWORD]` yerine adım 1'deki şifreyi yaz.

## 2) Yerelde tabloları oluştur

1. Proje klasöründeki **`.env`** dosyasını aç, iki satırı yapıştır (bkz. `.env.example`).
2. Terminalde:
   ```bash
   npm run setup
   ```
   Bu, Supabase'te tabloları oluşturur ve ilk admin kullanıcıyı ekler: **deren / 1234**.

## 3) GitHub'a gönder

1. [github.com/new](https://github.com/new) → boş bir repo oluştur (README ekleme). Adı ör: `lojistik-is-takibi`.
2. Terminalde (repo adresini kendi hesabınla değiştir):
   ```bash
   git remote add origin https://github.com/KULLANICI/lojistik-is-takibi.git
   git branch -M main
   git push -u origin main
   ```

## 4) Railway — barındırma

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → bu repoyu seç.
2. **Variables** sekmesine şunları ekle (Supabase'ten):
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NODE_ENV` = `production`
3. Railway otomatik derler (`npm run build`) ve başlatır (`npm start`).
4. **Settings → Networking → Generate Domain** ile adres oluştur.

Bittiğinde uygulaman `https://...railway.app` adresinde canlı olur. Giriş: **deren / 1234**
(İlk girişten sonra şifreni **Kullanıcılar** ekranından değiştir.)

---

### Sonraki güncellemeler
GitHub'a `git push` yaptığın her seferde Railway otomatik yeniden yayınlar.
Veri modelini değiştirirsek `npm run db:push` ile Supabase'i güncelleriz.
