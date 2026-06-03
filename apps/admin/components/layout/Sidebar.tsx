"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard",              label: "Overview",       icon: "🏠" },
  { href: "/dashboard/vendors",      label: "Vendors",        icon: "🏟️" },
  { href: "/dashboard/users",        label: "Users",          icon: "👥" },
  { href: "/dashboard/bookings",     label: "Bookings",       icon: "📅" },
  { href: "/dashboard/revenue",      label: "Revenue",        icon: "💰" },
  { href: "/dashboard/notifications",label: "Notifications",  icon: "🔔" },
  { href: "/dashboard/settings",     label: "Settings",       icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-52 shrink-0 flex flex-col min-h-screen bg-sidebar border-r border-[#1a1a1a]">
      <div className="px-5 py-5 border-b border-[#1a1a1a]">
        <span className="text-lg font-black text-white tracking-tight">DOME</span>
        <span className="ml-2 text-xs text-primary font-bold uppercase tracking-wider">Admin</span>
      </div>

      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 py-2.5 px-3 text-sm font-medium rounded-dome transition-colors border-l-2 ${
                active
                  ? "border-primary text-primary bg-primary/[0.08]"
                  : "border-transparent text-muted hover:text-white hover:bg-white/[0.03]"
              }`}>
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[#1a1a1a] text-xs text-muted">
        Internal Tool · v1.0
      </div>
    </aside>
  );
}
