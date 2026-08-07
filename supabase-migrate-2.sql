-- Lojistik İş Takibi — 2. güncelleme
-- "Kimden istendi" (requesterId) + "Takip-Destek" (çoklu kişi) alanları.
-- Supabase → SQL Editor → yapıştır → Run. Birden fazla çalıştırılsa da güvenli.

-- 1) Job.requesterId sütunu
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "requesterId" TEXT;

-- 2) Takip-Destek ilişki tablosu (çoklu kişi)
CREATE TABLE IF NOT EXISTS "_JobSupport" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_JobSupport_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX IF NOT EXISTS "_JobSupport_B_index" ON "_JobSupport"("B");

-- 3) İlişki bütünlüğü (FK'ler) — zaten varsa atlanır
DO $$ BEGIN
  ALTER TABLE "Job" ADD CONSTRAINT "Job_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "_JobSupport" ADD CONSTRAINT "_JobSupport_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "_JobSupport" ADD CONSTRAINT "_JobSupport_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
