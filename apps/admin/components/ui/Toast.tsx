"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

const STYLES = {
  success: "bg-green-900/90 border-green-700 text-green-300",
  error:   "bg-red-900/90 border-red-700 text-red-300",
  info:    "bg-surface border-border text-white",
};

const ICONS = { success: "✅", error: "❌", info: "ℹ️" };

export default function Toast({ message, type = "info", onClose, duration = 3500 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-dome border shadow-2xl text-sm font-medium max-w-sm ${STYLES[type]}`}>
      <span>{ICONS[type]}</span>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity ml-2">✕</button>
    </div>
  );
}
