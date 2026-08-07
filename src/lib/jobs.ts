import type { CurrentUser } from "./auth";

// Bir kullanıcının görebileceği işleri sınırlayan Prisma filtresi.
// Müdür her şeyi görür. Diğerleri: herkese açık işler + kendi ilgili oldukları (sorumlu/oluşturan/takip-destek).
export function visibleJobsWhere(user: CurrentUser) {
  if (user.role === "MUDUR") return {};
  return {
    OR: [
      { visibility: "HERKES" },
      { assigneeId: user.id },
      { createdById: user.id },
      { support: { some: { id: user.id } } },
    ],
  };
}

// Tek bir işi bu kullanıcı görebilir mi?
export function canSeeJob(
  user: CurrentUser,
  job: { visibility: string; assigneeId: string | null; createdById: string; support?: { id: string }[] }
) {
  if (user.role === "MUDUR") return true;
  if (job.visibility === "HERKES") return true;
  if (job.assigneeId === user.id) return true;
  if (job.createdById === user.id) return true;
  if (job.support?.some((s) => s.id === user.id)) return true;
  return false;
}
