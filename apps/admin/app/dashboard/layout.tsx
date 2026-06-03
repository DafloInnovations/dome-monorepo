"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/layout/Sidebar";
import { isAdmin } from "../../lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAdmin()) router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">{children}</div>
    </div>
  );
}
