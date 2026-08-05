"use client";

import { useEffect, useState } from "react";

export default function ThemeButton() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(localStorage.getItem("deren_theme") === "gece");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "gece");
      localStorage.setItem("deren_theme", "gece");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("deren_theme");
    }
  };

  return (
    <button
      className="btn sm ghost"
      type="button"
      onClick={toggle}
      title="Temayı değiştir"
      style={{ flex: 1, justifyContent: "center" }}
    >
      {dark ? "☀️ Aydınlık" : "🌙 Koyu"}
    </button>
  );
}
