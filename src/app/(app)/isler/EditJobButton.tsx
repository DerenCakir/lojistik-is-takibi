"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import JobForm, { type UserOption } from "./JobForm";
import { updateJob } from "./actions";

type Props = {
  users: UserOption[];
  job: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    dueDate: string; // YYYY-MM-DD veya ""
    assigneeId: string | null;
  };
};

export default function EditJobButton({ users, job }: Props) {
  const [open, setOpen] = useState(false);

  async function action(formData: FormData) {
    await updateJob(formData);
    setOpen(false);
  }

  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)} style={{ gap: 6 }}><Icon name="edit" size={14} /> Düzenle</button>
      {open && (
        <Modal title="İşi Düzenle" onClose={() => setOpen(false)}>
          <JobForm action={action} users={users} submitLabel="Kaydet" initial={job} />
        </Modal>
      )}
    </>
  );
}
