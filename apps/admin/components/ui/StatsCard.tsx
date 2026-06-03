interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  highlight?: boolean;
  urgent?: boolean;
}

export default function StatsCard({ label, value, sub, icon, highlight, urgent }: Props) {
  return (
    <div className={`rounded-dome border p-5 ${urgent ? "bg-primary/5 border-primary/30" : "bg-surface border-border"}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`text-3xl font-black ${highlight || urgent ? "text-primary" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}
