"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "../../../components/layout/Header";
import DataTable from "../../../components/ui/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge";
import { apiFetch, type AdminUser } from "../../../lib/api";

const PAGE_SIZE = 25;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (phone) qs.set("phone", phone);
    apiFetch<{ data: AdminUser[]; total: number }>(`/admin/users?${qs}`)
      .then((r) => { setUsers(r.data); setTotal(r.total); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setIsLoading(false));
  }, [page, phone]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPhone(search);
    setPage(1);
  }

  return (
    <>
      <Header title="Users" />
      <main className="flex-1 p-6 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="tel"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by phone…"
            className="bg-black border border-border rounded-dome px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary w-56"
          />
          <button type="submit"
            className="px-4 py-1.5 bg-surface border border-border rounded-dome text-sm text-white hover:border-primary/50 transition-colors">
            Search
          </button>
          {phone && (
            <button type="button" onClick={() => { setSearch(""); setPhone(""); setPage(1); }}
              className="text-xs text-muted hover:text-white transition-colors">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted self-center">{total} users</span>
        </form>

        {loadError && (
          <p className="text-red-400 text-sm">{loadError}</p>
        )}

        <DataTable
          isLoading={isLoading}
          data={users as unknown as Record<string, unknown>[]}
          emptyMessage="No users found"
          columns={[
            {
              key: "name",
              header: "Name",
              render: (r) => {
                const u = r as unknown as AdminUser;
                const name = `${u.firstName} ${u.lastName}`.trim() || "—";
                return (
                  <Link href={`/dashboard/users/${u.id}`} className="text-white hover:text-primary font-medium">
                    {name}
                  </Link>
                );
              },
            },
            { key: "phone", header: "Phone", render: (r) => (r as unknown as AdminUser).phone },
            {
              key: "role",
              header: "Role",
              render: (r) => <StatusBadge status={(r as unknown as AdminUser).role} />,
            },
            { key: "province", header: "Province", render: (r) => (r as unknown as AdminUser).province },
            {
              key: "creditBalanceCAD",
              header: "Credits",
              render: (r) => `C$${((r as unknown as AdminUser).creditBalanceCAD ?? 0).toFixed(2)}`,
            },
            {
              key: "bookings",
              header: "Bookings",
              render: (r) => String((r as unknown as AdminUser)._count?.bookings ?? 0),
            },
            {
              key: "createdAt",
              header: "Joined",
              render: (r) => new Date((r as unknown as AdminUser).createdAt).toLocaleDateString("en-CA"),
            },
          ]}
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-muted">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-border rounded-dome disabled:opacity-40 hover:text-white hover:border-primary/50 transition-colors">
              ← Prev
            </button>
            <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
            <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-border rounded-dome disabled:opacity-40 hover:text-white hover:border-primary/50 transition-colors">
              Next →
            </button>
          </div>
        )}
      </main>
    </>
  );
}
