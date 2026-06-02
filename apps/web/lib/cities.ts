export interface City {
  name: string;
  province: string;
  lat: number;
  lng: number;
  emoji: string;
}

export const CITIES: City[] = [
  { name: "Toronto",   province: "ON", lat: 43.6532, lng: -79.3832, emoji: "🏙️" },
  { name: "Vancouver", province: "BC", lat: 49.2827, lng: -123.1207, emoji: "🌲" },
  { name: "Calgary",   province: "AB", lat: 51.0447, lng: -114.0719, emoji: "🤠" },
  { name: "Montreal",  province: "QC", lat: 45.5017, lng: -73.5673, emoji: "🎭" },
  { name: "Ottawa",    province: "ON", lat: 45.4215, lng: -75.6972, emoji: "🍁" },
  { name: "Edmonton",  province: "AB", lat: 53.5461, lng: -113.4938, emoji: "❄️" },
  { name: "Winnipeg",  province: "MB", lat: 49.8951, lng: -97.1384, emoji: "🌾" },
  { name: "Halifax",   province: "NS", lat: 44.6488, lng: -63.5752, emoji: "⚓" },
];

export const SPORTS = [
  { slug: "badminton",   label: "Badminton",   emoji: "🏸" },
  { slug: "pickleball",  label: "Pickleball",  emoji: "🏓" },
  { slug: "tennis",      label: "Tennis",      emoji: "🎾" },
  { slug: "basketball",  label: "Basketball",  emoji: "🏀" },
  { slug: "soccer",      label: "Soccer",      emoji: "⚽" },
  { slug: "cricket",     label: "Cricket",     emoji: "🏏" },
  { slug: "volleyball",  label: "Volleyball",  emoji: "🏐" },
  { slug: "hockey",      label: "Hockey",      emoji: "🏒" },
];

export function getSportEmoji(sport: string): string {
  return SPORTS.find((s) => s.slug === sport.toLowerCase())?.emoji ?? "🏟️";
}
