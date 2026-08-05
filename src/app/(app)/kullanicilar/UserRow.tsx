"use client";

import { useState } from "react";
import { updateUser, toggleUserActive, resetPassword } from "./actions";

type Props = {
  u: { id: string; username: string; name: string; role: string; active: boolean };
  isSelf: boolean;
};

export default function UserRow({ u, isSelf }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="item">
      <div className="top">
        <div className="avatar" style={{ marginTop: 2 }}>
          {u.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div className="title">
            {u.name} {isSelf && <span className="mini">(siz)</span>}
          </div>
          <div className="meta">
            <span>@{u.username}</span>
            <span className="chip">{u.role === "MANAGER" ? "Yönetici" : "Çalışan"}</span>
            {!u.active && <span className="status-pill st-open">Pasif</span>}
          </div>
        </div>
        <div className="acts">
          <button className="btn sm ghost" onClick={() => setOpen(!open)}>{open ? "Kapat" : "Yönet"}</button>
        </div>
      </div>

      {open && (
        <>
          <div className="divider" />
          <div className="grid g2">
            {/* Ad + rol düzenle */}
            <form action={updateUser} className="formgrid">
              <input type="hidden" name="id" value={u.id} />
              <div>
                <label>Ad Soyad</label>
                <input name="name" defaultValue={u.name} required />
              </div>
              <div>
                <label>Rol</label>
                <select name="role" defaultValue={u.role} disabled={isSelf}>
                  <option value="EMPLOYEE">Çalışan</option>
                  <option value="MANAGER">Yönetici</option>
                </select>
                {isSelf && <div className="mini" style={{ marginTop: 4 }}>Kendi rolünüzü değiştiremezsiniz.</div>}
              </div>
              <button className="btn sm primary" type="submit">Kaydet</button>
            </form>

            {/* Şifre sıfırla + aktiflik */}
            <div className="formgrid">
              <form action={resetPassword} className="formgrid">
                <input type="hidden" name="id" value={u.id} />
                <div>
                  <label>Yeni şifre belirle</label>
                  <input name="password" placeholder="En az 4 karakter" required />
                </div>
                <button className="btn sm" type="submit">Şifreyi Sıfırla</button>
              </form>
              {!isSelf && (
                <form action={toggleUserActive}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className={`btn sm ${u.active ? "danger" : ""}`} type="submit">
                    {u.active ? "Pasifleştir" : "Aktifleştir"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
