"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import EventForm from "./EventForm";
import { createEvent } from "./actions";

export default function NewEventButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ Yeni Etkinlik</button>
      {open && (
        <Modal title="Yeni Etkinlik" onClose={() => setOpen(false)}>
          <EventForm action={createEvent} submitLabel="Oluştur" />
        </Modal>
      )}
    </>
  );
}
