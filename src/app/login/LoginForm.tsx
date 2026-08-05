"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

const initialState = { error: "" };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction}>
      {state?.error ? <div className="err">{state.error}</div> : null}
      <div className="field">
        <label htmlFor="username">Kullanıcı adı</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Şifre</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="btn primary" type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
        {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
      </button>
    </form>
  );
}
