"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function parseDate(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Herkes her şeyi yapabilir — sadece giriş şartı.
async function requireManager() {
  return requireUser();
}

export async function createEvent(formData: FormData) {
  const user = await requireManager();
  const title = String(formData.get("title") ?? "").trim();
  const date = parseDate(formData.get("date"));
  if (!title || !date) return;

  const event = await db.event.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").trim(),
      date,
      createdById: user.id,
    },
  });
  revalidatePath("/takvim");
  revalidatePath("/");
  redirect(`/takvim/${event.id}`);
}

export async function updateEvent(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const date = parseDate(formData.get("date"));
  if (!id || !title || !date) return;

  await db.event.update({
    where: { id },
    data: { title, description: String(formData.get("description") ?? "").trim(), date },
  });
  revalidatePath("/takvim");
  revalidatePath(`/takvim/${id}`);
  revalidatePath("/");
}

export async function deleteEvent(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.event.delete({ where: { id } });
  revalidatePath("/takvim");
  revalidatePath("/");
  redirect("/takvim");
}

// ---- Etkinlik görevleri (yönetici ekler, herkes tamamlar) ----
export async function addEventTask(formData: FormData) {
  await requireManager();
  const eventId = String(formData.get("eventId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!eventId || !text) return;

  const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
  const count = await db.eventTask.count({ where: { eventId } });
  await db.eventTask.create({
    data: { eventId, text, note: String(formData.get("note") ?? "").trim(), assigneeId, order: count },
  });
  revalidatePath(`/takvim/${eventId}`);
}

export async function toggleEventTask(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!id) return;
  const task = await db.eventTask.findUnique({ where: { id } });
  if (task) await db.eventTask.update({ where: { id }, data: { done: !task.done } });
  revalidatePath(`/takvim/${eventId}`);
}

// Çalışan da not/geliştirme yazabilsin diye görev notunu güncelle
export async function updateEventTaskNote(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!id) return;
  await db.eventTask.update({ where: { id }, data: { note: String(formData.get("note") ?? "").trim() } });
  revalidatePath(`/takvim/${eventId}`);
}

export async function deleteEventTask(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!id) return;
  await db.eventTask.delete({ where: { id } });
  revalidatePath(`/takvim/${eventId}`);
}
