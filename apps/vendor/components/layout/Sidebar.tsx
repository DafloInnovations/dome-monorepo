"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVendorProfile } from "./VendorProfileProvider";

const NAV = [
  { href: "/dashboard",            label: "Dashboard",     icon: "🏠" },
  { href: "/dashboard/facilities", label: "Sports",        icon: "🏟️" },
  { href: "/dashboard/bookings",   label: "Bookings",      icon: "📅" },
  { href: "/dashboard/walkin",     label: "Walk-in POS",   icon: "💵" },
  { href: "/dashboard/analytics",  label: "Analytics",     icon: "📊" },
  { href: "/dashboard/connect",    label: "Connect Games", icon: "🤝" },
  { href: "/dashboard/membership", label: "Manage Membership", icon: "💳" },
  { href: "/dashboard/equipment",  label: "Equipment",     icon: "🎒" },
  { href: "/dashboard/pricing",     label: "Pricing",       icon: "⚡" },
  { href: "/dashboard/reviews",    label: "Reviews",       icon: "⭐" },
  { href: "/dashboard/recurring",  label: "Recurring",     icon: "🔄" },
  { href: "/dashboard/settings",   label: "Settings",      icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { businessName, initials, statusLabel } = useVendorProfile();

  return (
    <aside className="w-56 shrink-0 flex flex-col min-h-screen bg-[#0D0D0D] border-r border-[#222]">
      <div className="px-5 py-5 border-b border-[#222]">
        <div className="h-12 w-12 rounded-full bg-primary/25 border-2 border-primary flex items-center justify-center text-primary font-black text-base">
          {initials}
        </div>
        <div className="mt-3 min-w-0">
          <p className="truncate text-sm font-bold text-white">{businessName}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span>{statusLabel}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 py-2.5 text-sm font-medium transition-colors border-l-2 ${
                active
                  ? "border-primary text-primary bg-primary/[0.07] pl-[10px] pr-3"
                  : "border-transparent text-muted hover:text-white hover:bg-white/[0.03] pl-[10px] pr-3"
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[#222] text-xs text-muted">
        Dome Vendor Portal
      </div>
    </aside>
  );
}
