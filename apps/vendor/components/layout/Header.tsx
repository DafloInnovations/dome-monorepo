"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "../../lib/api";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("Vendor Portal");

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        JSON.parse(atob(token.split(".")[1]!));
        const name = localStorage.getItem("businessName");
        if (name) setBusinessName(name);
      } catch {}
    }
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  return (
    <header className="h-14 border-b border-[#222] bg-[#111] flex items-center justify-between px-6 shrink-0">
      <h1 className="text-base font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted">{businessName}</span>
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
