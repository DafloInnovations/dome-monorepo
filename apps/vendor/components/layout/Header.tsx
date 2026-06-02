"use client";

import { logout } from "../../lib/auth";
import { getCurrentUser } from "../../lib/api";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const user = getCurrentUser();
  const displayName = user?.businessName
    ?? (user ? `${user.firstName} ${user.lastName}`.trim() : "Vendor");

  return (
    <header className="h-14 border-b border-border bg-black flex items-center justify-between px-6 shrink-0">
      <h1 className="text-base font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-white leading-none">{displayName}</p>
          {user?.phone && (
            <p className="text-xs text-muted mt-0.5">{user.phone}</p>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-sm font-bold">
          {displayName[0]?.toUpperCase() ?? "V"}
        </div>
        <button
          onClick={logout}
          className="text-sm text-muted hover:text-white transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
