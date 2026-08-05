"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import EventForm from "./EventForm";
import { updateEvent } from "./actions";

type Props = {
  event: { id: string; title: string; description: string; date: string };
};

export default function EditEventButton({ event }: Props) {
  const [open, setOpen] = useState(false);

  async function action(formData: FormData) {
    await updateEvent(formData);
    setOpen(false);
  }

  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)} style={{ gap: 6 }}><Icon name="edit" size={14} /> Düzenle</button>
      {open && (
        <Modal title="Etkinliği Düzenle" onClose={() => setOpen(false)}>
          <EventForm action={action} submitLabel="Kaydet" initial={event} />
        </Modal>
      )}
    </>
  );
}
