import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StarRating from "../../../components/ui/StarRating";
import SlotPicker from "../../../components/ui/SlotPicker";
import SlotBookingCta from "./SlotBookingCta";
import { API_URL, serverFetch, type Facility, type Review } from "../../../lib/api";
import { getSportEmoji } from "../../../lib/cities";

interface PageProps { params: { id: string } }

interface FacilityDetail extends Facility {
  reviews?: Review[];
}

async function getFacility(id: string): Promise<FacilityDetail | null> {
  try {
    const res = await serverFetch<{ data: FacilityDetail }>(`/facilities/${id}`);
    return res.data;
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const f = await getFacility(params.id);
  if (!f) return { title: "Facility Not Found" };

  const sport = f.sport.charAt(0).toUpperCase() + f.sport.slice(1).toLowerCase();
  const city  = f.address?.city ?? "Canada";
  const title = `${f.name} — Book ${sport} in ${city}`;
  const desc  = `Book ${sport} at ${f.name} in ${city}. ${f.description?.slice(0, 120) ?? "Real-time availability, instant confirmation."}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: f.images?.[0] ? [{ url: f.images[0] }] : [],
    },
  };
}

export default async function FacilityDetailPage({ params }: PageProps) {
  const facility = await getFacility(params.id);
  if (!facility) notFound();

  const sport   = facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase();
  const emoji   = getSportEmoji(facility.sport);
  const city    = facility.address?.city ?? "";
  const address = facility.address
    ? `${facility.address.street}, ${facility.address.city}, ${facility.address.province} ${facility.address.postalCode}`
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: facility.name,
    description: facility.description,
    address: facility.address ? {
      "@type": "PostalAddress",
      streetAddress: facility.address.street,
      addressLocality: facility.address.city,
      addressRegion: facility.address.province,
      postalCode: facility.address.postalCode,
      addressCountry: "CA",
    } : undefined,
    aggregateRating: facility.averageRating != null ? {
      "@type": "AggregateRating",
      ratingValue: facility.averageRating.toFixed(1),
      reviewCount: facility.totalReviews,
    } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: details ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Hero image */}
            <div className="relative h-64 md:h-80 bg-surface-2 rounded-dome overflow-hidden">
              {facility.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={facility.images[0]} alt={facility.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-9xl opacity-20">{emoji}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <h1 className="text-3xl font-black text-white mb-1">{facility.name}</h1>
                {address && <p className="text-sm text-white/70">📍 {address}</p>}
              </div>
            </div>

            {/* Rating + meta */}
            <div className="bg-surface border border-border rounded-dome p-5">
              <div className="flex flex-wrap gap-6">
                {facility.averageRating != null && (
                  <div>
                    <p className="text-xs text-muted mb-1">Rating</p>
                    <div className="flex items-center gap-2">
                      <StarRating rating={facility.averageRating} size="md" />
                      <span className="text-white font-bold">{facility.averageRating.toFixed(1)}</span>
                      <span className="text-muted text-sm">({facility.totalReviews} reviews)</span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted mb-1">Sport</p>
                  <p className="text-white font-semibold">{emoji} {sport}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Surface</p>
                  <p className="text-white font-semibold capitalize">{facility.surface?.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Capacity</p>
                  <p className="text-white font-semibold">{facility.capacity} players</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Courts</p>
                  <p className="text-white font-semibold">{facility.courts?.length ?? 0} available</p>
                </div>
              </div>
            </div>

            {/* Description */}
            {facility.description && (
              <div className="bg-surface border border-border rounded-dome p-5">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">About</h2>
                <p className="text-white/80 text-sm leading-relaxed">{facility.description}</p>
              </div>
            )}

            {/* Amenities */}
            {facility.amenities?.length > 0 && (
              <div className="bg-surface border border-border rounded-dome p-5">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {facility.amenities.map(({ amenity }) => (
                    <span key={amenity.id} className="bg-surface-2 border border-border rounded-full px-3 py-1 text-xs text-white">
                      {amenity.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {(facility.reviews?.length ?? 0) > 0 && (
              <div className="bg-surface border border-border rounded-dome p-5">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Reviews</h2>
                <div className="space-y-4">
                  {facility.reviews!.slice(0, 5).map((review) => (
                    <div key={review.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {review.user.firstName} {review.user.lastName.charAt(0)}.
                          </span>
                          <StarRating rating={review.rating} />
                        </div>
                        <span className="text-xs text-muted">
                          {new Date(review.createdAt).toLocaleDateString("en-CA", { month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {review.comment && <p className="text-sm text-muted leading-relaxed">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map placeholder */}
            <div className="bg-surface border border-border rounded-dome p-5">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Location</h2>
              <div className="h-48 bg-surface-2 rounded-dome flex items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl mb-2">📍</p>
                  <p className="text-sm text-muted">{address ?? city}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: booking sidebar ─────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-surface border border-border rounded-dome p-5">
                <h2 className="text-base font-bold text-white mb-4">Select a Slot</h2>
                <SlotBookingCta facilityId={facility.id} facilityName={facility.name} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
