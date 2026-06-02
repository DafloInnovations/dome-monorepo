import Link from "next/link";
import StarRating from "./StarRating";
import { getSportEmoji } from "../../lib/cities";
import type { Facility } from "../../lib/api";

interface Props {
  facility: Facility;
  minPrice?: number;
}

export default function FacilityCard({ facility, minPrice }: Props) {
  const emoji = getSportEmoji(facility.sport);
  const city = facility.address?.city ?? "";
  const sport = facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase();

  return (
    <div className="bg-surface border border-border rounded-dome overflow-hidden hover:border-primary/40 transition-colors group">
      {/* Image / placeholder */}
      <div className="h-40 bg-surface-2 flex items-center justify-center relative">
        {facility.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={facility.images[0]} alt={facility.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-6xl opacity-30">{emoji}</span>
        )}
        <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-white">
          {emoji} {sport}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-white text-base mb-1 group-hover:text-primary transition-colors line-clamp-1">
          {facility.name}
        </h3>
        {city && (
          <p className="text-xs text-muted mb-2">
            📍 {facility.address?.street ? `${facility.address.street}, ` : ""}{city}
          </p>
        )}

        <div className="flex items-center gap-2 mb-3">
          {facility.averageRating != null ? (
            <>
              <StarRating rating={facility.averageRating} />
              <span className="text-xs text-muted">{facility.averageRating.toFixed(1)} ({facility.totalReviews})</span>
            </>
          ) : (
            <span className="text-xs text-muted">No reviews yet</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            {minPrice != null ? (
              <p className="text-sm font-bold text-white">
                From <span className="text-primary">C${minPrice.toFixed(0)}</span>/hr
              </p>
            ) : (
              <p className="text-xs text-muted">{facility.courts?.length ?? 0} court{facility.courts?.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <Link
            href={`/facilities/${facility.id}`}
            className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2 rounded-dome transition-colors"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}
