interface Props {
  rating: number;
  max?: number;
  size?: "sm" | "md";
}

export default function StarRating({ rating, max = 5, size = "sm" }: Props) {
  const sz = size === "sm" ? "text-xs" : "text-sm";
  return (
    <span className={`flex items-center gap-0.5 ${sz}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? "text-yellow-400" : "text-muted"}>★</span>
      ))}
    </span>
  );
}
