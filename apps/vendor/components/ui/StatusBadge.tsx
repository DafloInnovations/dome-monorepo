const STYLES: Record<string, string> = {
  CONFIRMED: "bg-green-900/40 text-green-400 border-green-800",
  COMPLETED: "bg-green-900/20 text-green-600 border-green-900",
  PENDING:   "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  CANCELLED: "bg-red-900/40 text-red-400 border-red-800",
  AVAILABLE: "bg-green-900/40 text-green-400 border-green-800",
  BOOKED:    "bg-red-900/40 text-red-400 border-red-800",
  HELD:      "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  BLOCKED:   "bg-gray-800 text-muted border-gray-700",
  OPEN:      "bg-blue-900/40 text-blue-400 border-blue-800",
  CLOSED:    "bg-gray-800 text-muted border-gray-700",
};

const LABELS: Record<string, string> = {
  OPEN_GAME: "Open Game",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = STYLES[status] ?? "bg-surface border-border text-muted";
  const label = LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${style} ${className}`}>
      {label}
    </span>
  );
}
