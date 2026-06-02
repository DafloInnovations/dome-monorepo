"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser, clearToken, type StoredUser } from "../../lib/auth";

const NAV = [
  { href: "/facilities", label: "Facilities" },
  { href: "/connect",    label: "Connect" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  function handleLogout() {
    clearToken();
    setUser(null);
    setDropOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-2xl font-black text-white tracking-tight">
          DOME
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                pathname.startsWith(href) ? "text-white" : "text-muted hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <Link href="/bookings" className={`text-sm font-medium transition-colors ${pathname.startsWith("/bookings") ? "text-white" : "text-muted hover:text-white"}`}>
              My Bookings
            </Link>
          ) : null}
        </nav>

        {/* Right: auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-dome bg-surface border border-border text-sm text-white hover:border-primary/50 transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-xs font-bold">
                  {user.firstName?.[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="hidden sm:block">{user.firstName}</span>
                <span className="text-muted text-xs">▾</span>
              </button>
              {dropOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-surface border border-border rounded-dome shadow-xl overflow-hidden">
                  <Link href="/profile" onClick={() => setDropOpen(false)} className="block px-4 py-2.5 text-sm text-white hover:bg-surface-2 transition-colors">Profile</Link>
                  <Link href="/bookings" onClick={() => setDropOpen(false)} className="block px-4 py-2.5 text-sm text-white hover:bg-surface-2 transition-colors">My Bookings</Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-surface-2 transition-colors border-t border-border">Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors"
            >
              Sign In
            </Link>
          )}

          {/* Hamburger */}
          <button
            className="md:hidden p-2 text-muted hover:text-white transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-surface">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm text-white hover:text-primary border-b border-border transition-colors"
            >
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/bookings" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-white hover:text-primary border-b border-border">My Bookings</Link>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-white hover:text-primary border-b border-border">Profile</Link>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-red-400">Sign Out</button>
            </>
          ) : (
            <Link href="/login" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-primary font-semibold">Sign In →</Link>
          )}
        </div>
      )}
    </header>
  );
}
