"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getStoredUser, type AdminUser } from "../../lib/auth";

export default function Header({ title }: { title: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => { setUser(getStoredUser()); }, []);

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.phone : "Admin";

  return (
    <header className="h-14 bg-black border-b border-[#1a1a1a] flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted hidden sm:block">{name}</span>
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-xs font-bold">
          {name[0]?.toUpperCase()}
        </div>
        <button onClick={handleLogout} className="text-xs text-muted hover:text-white transition-colors">
          Logout
        </button>
      </div>
    </header>
  );
}
