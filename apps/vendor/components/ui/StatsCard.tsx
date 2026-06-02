interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number; // positive = up, negative = down
  icon?: string;
}

export default function StatsCard({ label, value, sub, trend, icon }: StatsCardProps) {
  return (
    <div className="bg-surface rounded-dome border border-border p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted font-medium">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-3xl font-bold text-white">{value}</p>
        {sub && <p className="text-muted text-sm mb-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <p className={`mt-1 text-xs font-medium ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last month
        </p>
      )}
    </div>
  );
}
