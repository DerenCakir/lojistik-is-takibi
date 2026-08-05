import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import NewJobButton from "./NewJobButton";
import JobList, { type JobRow } from "./JobList";

export default async function JobsPage() {
  await requireUser();

  const [jobs, users] = await Promise.all([
    db.job.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignee: { select: { name: true } },
        _count: { select: { tasks: true, updates: true } },
        tasks: { select: { done: true } },
      },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: JobRow[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    priority: j.priority,
    dueDate: j.dueDate ? j.dueDate.toISOString() : null,
    assigneeName: j.assignee?.name ?? null,
    taskDone: j.tasks.filter((t) => t.done).length,
    taskTotal: j.tasks.length,
    updateCount: j._count.updates,
  }));

  return (
    <>
      <div className="topbar">
        <div>
          <h2>İşler</h2>
          <div className="sub">Takip edilen tüm işler</div>
        </div>
        <div className="spacer" />
        <NewJobButton users={users} />
      </div>
      <div className="content">
        <JobList jobs={rows} />
      </div>
    </>
  );
}
