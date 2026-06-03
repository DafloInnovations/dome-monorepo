import React from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns, data, isLoading, emptyMessage = "No data",
}: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-dome border border-border">
      <table className="w-full text-sm min-w-max">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted">{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ""}`}>
                    {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
