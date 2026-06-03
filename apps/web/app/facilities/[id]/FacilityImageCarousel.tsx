"use client";

import { useState } from "react";

interface Props {
  images: string[];
  facilityName: string;
  address?: string | null;
  fallbackEmoji: string;
}

export default function FacilityImageCarousel({ images, facilityName, address, fallbackEmoji }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;
  const activeImage = images[activeIndex];

  function move(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + images.length) % images.length);
  }

  return (
    <div className="relative h-64 md:h-80 bg-surface-2 rounded-dome overflow-hidden">
      {hasImages && activeImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={activeImage} alt={`${facilityName} photo ${activeIndex + 1}`} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-9xl opacity-20">{fallbackEmoji}</span>
        </div>
      )}

      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/70 border border-white/15 text-white text-2xl hover:border-primary transition-colors"
            aria-label="Previous facility photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/70 border border-white/15 text-white text-2xl hover:border-primary transition-colors"
            aria-label="Next facility photo"
          >
            ›
          </button>
          <div className="absolute top-4 right-4 rounded-full bg-black/70 border border-white/15 px-3 py-1 text-xs font-semibold text-white">
            {activeIndex + 1}/{images.length}
          </div>
        </>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

      {hasMultipleImages && (
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? "w-5 bg-primary" : "w-2 bg-white/45 hover:bg-white/70"
              }`}
              aria-label={`Show facility photo ${index + 1}`}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-0 left-0 p-6">
        <h1 className="text-3xl font-black text-white mb-1">{facilityName}</h1>
        {address && <p className="text-sm text-white/70">📍 {address}</p>}
      </div>
    </div>
  );
}
