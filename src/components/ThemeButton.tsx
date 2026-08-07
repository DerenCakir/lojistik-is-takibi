"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

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
      className="sidebtn"
      type="button"
      onClick={toggle}
      title={dark ? "Aydınlık temaya geç" : "Koyu temaya geç"}
      aria-label="Temayı değiştir"
    >
      <Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}
