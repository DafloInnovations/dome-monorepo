import type { CanadianProvince } from "./user";

export type SportType =
  | "soccer"
  | "basketball"
  | "tennis"
  | "badminton"
  | "volleyball"
  | "hockey"
  | "squash"
  | "pickleball"
  | "baseball"
  | "cricket";

export type SurfaceType =
  | "turf"
  | "hardwood"
  | "concrete"
  | "clay"
  | "ice"
  | "grass"
  | "rubberized";

export interface FacilityAddress {
  street: string;
  city: string;
  province: CanadianProvince;
  postalCode: string;
  country: "CA";
  lat?: number;
  lng?: number;
}

export interface FacilityAmenity {
  id: string;
  name: string;
  iconSlug?: string;
}

export interface OperatingHours {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface Facility {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  address: FacilityAddress;
  sport: SportType;
  surface: SurfaceType;
  capacity: number;
  amenities: FacilityAmenity[];
  images: string[];
  operatingHours: OperatingHours[];
  isActive: boolean;
  averageRating?: number;
  totalReviews?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFacilityInput {
  name: string;
  description: string;
  address: Omit<FacilityAddress, "lat" | "lng">;
  sport: SportType;
  surface: SurfaceType;
  capacity: number;
  amenityIds?: string[];
  operatingHours: OperatingHours[];
}

export interface FacilityFilters {
  sport?: SportType;
  city?: string;
  province?: CanadianProvince;
  date?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  minRating?: number;
}
