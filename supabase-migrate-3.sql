-- Lojistik İş Takibi — 3. güncelleme
-- Roller (3 kademe) + iş görünürlüğü + checklist kişi etiketleri + admin (Deren).
-- Supabase → SQL Editor → yapıştır → Run. Birden fazla çalıştırılsa da güvenli.

-- 1) İş görünürlüğü
ALTER TABLE "Job"  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'HERKES';

-- 2) Admin bayrağı (kullanıcı yönetimi)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- 3) Checklist maddelerine etiketlenen kişiler (çoklu)
CREATE TABLE IF NOT EXISTS "_JobTaskTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_JobTaskTags_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX IF NOT EXISTS "_JobTaskTags_B_index" ON "_JobTaskTags"("B");

DO $$ BEGIN
  ALTER TABLE "_JobTaskTags" ADD CONSTRAINT "_JobTaskTags_A_fkey"
    FOREIGN KEY ("A") REFERENCES "JobTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "_JobTaskTags" ADD CONSTRAINT "_JobTaskTags_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4) Eski rolleri yeni adlara çevir
UPDATE "User" SET "role" = 'YONETICI' WHERE "role" = 'MANAGER';
UPDATE "User" SET "role" = 'CALISAN'  WHERE "role" = 'EMPLOYEE';

-- 5) Deren = admin (kullanıcı/yetki yönetimi)
UPDATE "User" SET "isAdmin" = true WHERE "username" = 'deren';
