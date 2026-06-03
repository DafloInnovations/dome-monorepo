"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/facilities");
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-white transition-colors"
    >
      <span className="text-xl leading-none">‹</span>
      Back
    </button>
  );
}
