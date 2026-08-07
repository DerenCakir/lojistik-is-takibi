import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);

  // ---- Kullanıcılar (yerel test). Roller: MUDUR | YONETICI | CALISAN ----
  const admin = await db.user.upsert({
    where: { username: "deren" },
    update: { role: "MUDUR", isAdmin: true },
    create: { username: "deren", name: "Deren", role: "MUDUR", isAdmin: true, passwordHash: await hash("1234") },
  });

  await db.user.upsert({
    where: { username: "selin" },
    update: { role: "CALISAN" },
    create: { username: "selin", name: "Selin", role: "CALISAN", passwordHash: await hash("1234") },
  });

  await db.user.upsert({
    where: { username: "veli" },
    update: {},
    create: { username: "veli", name: "Veli Yönetici", role: "YONETICI", passwordHash: await hash("1234") },
  });

  await db.user.upsert({
    where: { username: "ayse" },
    update: {},
    create: { username: "ayse", name: "Ayşe Çalışan", role: "CALISAN", passwordHash: await hash("1234") },
  });

  // ---- Örnek veriler (yalnızca sistem boşsa) ----
  const jobCount = await db.job.count();
  if (jobCount === 0) {
    await db.job.create({
      data: {
        title: "X Firması gümrük dosyası",
        description: "İthalat evraklarının tamamlanıp gümrüğe iletilmesi.",
        status: "DEVAM",
        priority: "YUKSEK",
        assigneeId: admin.id,
        createdById: admin.id,
        dueDate: new Date(Date.now() + 5 * 86400000),
        tasks: {
          create: [
            { text: "Fatura ve paketleme listesini topla", order: 0, done: true },
            { text: "Menşe belgesini kontrol et", order: 1 },
            { text: "Gümrük beyannamesini hazırla", order: 2 },
          ],
        },
        updates: {
          create: [{ authorId: admin.id, body: "Evraklar firmadan istendi, yarın gelmesi bekleniyor." }],
        },
      },
    });

    await db.job.create({
      data: {
        title: "Depo yerleşim planı revizyonu",
        description: "Yeni raf sistemine göre depo yerleşiminin güncellenmesi.",
        status: "BEKLEMEDE",
        priority: "ORTA",
        createdById: admin.id,
      },
    });
  }

  const eventCount = await db.event.count();
  if (eventCount === 0) {
    await db.event.create({
      data: {
        title: "Yıllık Gümrük Denetimi",
        description: "Resmi gümrük denetimi. Tüm evrak ve süreçlerin hazır olması gerekiyor.",
        date: new Date(Date.now() + 90 * 86400000), // ~3 ay sonra
        createdById: admin.id,
        tasks: {
          create: [
            { text: "Son 1 yılın beyannamelerini dosyala", order: 0 },
            { text: "Depo güvenlik kontrollerini tamamla", order: 1, note: "Yangın tüpleri ve acil çıkışlar dahil." },
            { text: "Personel eğitim kayıtlarını güncelle", order: 2 },
          ],
        },
      },
    });
  }

  console.log("✔ Seed tamam. Giriş bilgileri (ikisi de tam yetkili):");
  console.log("   deren  / 1234");
  console.log("   selin  / 1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
