"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearToken } from "../../lib/api";
import { useVendorProfile } from "./VendorProfileProvider";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const { businessName } = useVendorProfile();

  useEffect(() => {
    document.title = `${title} — ${businessName} | Dome`;
  }, [businessName, title]);

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  return (
    <header className="h-14 border-b border-[#222] bg-[#111] flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base font-black text-white tracking-tight">DOME</span>
        <span className="text-muted">|</span>
        <span className="truncate text-sm font-semibold text-white">{businessName}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted">{title}</span>
        <button
          onClick={handleLogout}
          className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-dome transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
