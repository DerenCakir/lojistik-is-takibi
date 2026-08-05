"use client";

import { useActionState, useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { createUser } from "./actions";

const initialState: { error?: string; ok?: boolean } = {};

export default function NewUserButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUser, initialState);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ Yeni Kullanıcı</button>
      {open && (
        <Modal title="Yeni Kullanıcı" onClose={() => setOpen(false)}>
          <form action={formAction} className="formgrid">
            {state?.error && <div className="err">{state.error}</div>}
            <div>
              <label htmlFor="nu-name">Ad Soyad *</label>
              <input id="nu-name" name="name" required placeholder="Örn: Ayşe Yılmaz" />
            </div>
            <div>
              <label htmlFor="nu-username">Kullanıcı adı *</label>
              <input id="nu-username" name="username" required placeholder="ayse" autoCapitalize="none" />
              <div className="mini" style={{ marginTop: 4 }}>Küçük harf, rakam, _ ve . kullanılabilir.</div>
            </div>
            <div className="row">
              <div style={{ minWidth: 150 }}>
                <label htmlFor="nu-password">Şifre *</label>
                <input id="nu-password" name="password" required placeholder="En az 4 karakter" />
              </div>
              <div style={{ minWidth: 150 }}>
                <label htmlFor="nu-role">Rol</label>
                <select id="nu-role" name="role" defaultValue="EMPLOYEE">
                  <option value="EMPLOYEE">Çalışan</option>
                  <option value="MANAGER">Yönetici</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn primary" type="submit" disabled={pending}>
                {pending ? "Ekleniyor…" : "Kullanıcı Ekle"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
