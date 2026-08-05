"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import JobForm, { type UserOption } from "./JobForm";
import { createJob } from "./actions";

export default function NewJobButton({ users }: { users: UserOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ Yeni İş</button>
      {open && (
        <Modal title="Yeni İş" onClose={() => setOpen(false)}>
          <JobForm action={createJob} users={users} submitLabel="Oluştur" />
        </Modal>
      )}
    </>
  );
}
