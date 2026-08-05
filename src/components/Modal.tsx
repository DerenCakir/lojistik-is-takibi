"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ title, onClose, children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,24,40,.5)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 16px",
        zIndex: 1000,
        overflow: "auto",
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 560,
          margin: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, flex: 1 }}>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Kapat" style={{ fontSize: 18 }}>
            ✕
          </button>
        </div>
        <div style={{ padding: "20px 22px" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
