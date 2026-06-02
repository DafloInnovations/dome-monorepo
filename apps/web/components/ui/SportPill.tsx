"use client";

interface Props {
  sport: string;
  emoji: string;
  active?: boolean;
  onClick?: () => void;
}

export default function SportPill({ sport, emoji, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
        active
          ? "bg-primary border-primary text-white"
          : "bg-surface border-border text-muted hover:text-white hover:border-primary/50"
      }`}
    >
      <span>{emoji}</span>
      <span>{sport}</span>
    </button>
  );
}
