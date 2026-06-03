"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Modal({
  open, title, children,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  destructive = false, isLoading = false,
  onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface border border-border rounded-dome p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-base font-bold text-white mb-4">{title}</h2>
        {children && <div className="mb-6">{children}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-white bg-surface-2 border border-border rounded-dome transition-colors disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={isLoading}
            className={`px-4 py-2 text-sm font-bold rounded-dome transition-colors disabled:opacity-50 ${
              destructive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-primary hover:bg-primary-hover text-white"
            }`}>
            {isLoading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
