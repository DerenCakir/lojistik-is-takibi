"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const STATUS_SET = new Set(["BEKLEMEDE", "DEVAM", "TAMAMLANDI"]);
const PRIORITY_SET = new Set(["DUSUK", "ORTA", "YUKSEK"]);

function parseDate(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function createJob(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const status = String(formData.get("status") ?? "BEKLEMEDE");
  const priority = String(formData.get("priority") ?? "ORTA");
  const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;

  const job = await db.job.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").trim(),
      status: STATUS_SET.has(status) ? status : "BEKLEMEDE",
      priority: PRIORITY_SET.has(priority) ? priority : "ORTA",
      dueDate: parseDate(formData.get("dueDate")),
      assigneeId,
      createdById: user.id,
    },
  });

  revalidatePath("/isler");
  revalidatePath("/");
  redirect(`/isler/${job.id}`);
}

export async function updateJob(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return;

  const status = String(formData.get("status") ?? "BEKLEMEDE");
  const priority = String(formData.get("priority") ?? "ORTA");
  const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;

  await db.job.update({
    where: { id },
    data: {
      title,
      description: String(formData.get("description") ?? "").trim(),
      status: STATUS_SET.has(status) ? status : "BEKLEMEDE",
      priority: PRIORITY_SET.has(priority) ? priority : "ORTA",
      dueDate: parseDate(formData.get("dueDate")),
      assigneeId,
    },
  });

  revalidatePath("/isler");
  revalidatePath(`/isler/${id}`);
  revalidatePath("/");
}

export async function setJobStatus(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUS_SET.has(status)) return;

  await db.job.update({ where: { id }, data: { status } });
  revalidatePath("/isler");
  revalidatePath(`/isler/${id}`);
  revalidatePath("/");
}

export async function deleteJob(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.job.delete({ where: { id } });
  revalidatePath("/isler");
  revalidatePath("/");
  redirect("/isler");
}

// ---- Gelişme / not akışı ----
export async function addJobUpdate(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get("jobId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!jobId || !body) return;

  await db.jobUpdate.create({ data: { jobId, authorId: user.id, body } });
  revalidatePath(`/isler/${jobId}`);
}

export async function deleteJobUpdate(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!id) return;
  await db.jobUpdate.delete({ where: { id } });
  revalidatePath(`/isler/${jobId}`);
}

// ---- İş checklist ----
export async function addJobTask(formData: FormData) {
  await requireUser();
  const jobId = String(formData.get("jobId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!jobId || !text) return;

  const count = await db.jobTask.count({ where: { jobId } });
  await db.jobTask.create({ data: { jobId, text, order: count } });
  revalidatePath(`/isler/${jobId}`);
}

export async function toggleJobTask(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!id) return;
  const task = await db.jobTask.findUnique({ where: { id } });
  if (task) await db.jobTask.update({ where: { id }, data: { done: !task.done } });
  revalidatePath(`/isler/${jobId}`);
}

export async function deleteJobTask(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!id) return;
  await db.jobTask.delete({ where: { id } });
  revalidatePath(`/isler/${jobId}`);
}
