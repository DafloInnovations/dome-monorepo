import { Image, StyleSheet, Text, View } from "react-native";

// Sport-specific themes: [topColor, bottomColor, emoji]
const SPORT_THEMES: Record<string, [string, string, string]> = {
  badminton:   ["#1a4731", "#0d2619", "🏸"],
  pickleball:  ["#2d4a1e", "#1a2e11", "🥒"],
  tennis:      ["#8b3a0f", "#5c2608", "🎾"],
  basketball:  ["#8b4513", "#5c2d0a", "🏀"],
  soccer:      ["#1a5c2a", "#0d3316", "⚽"],
  football:    ["#1a3d5c", "#0d2236", "🏈"],
  cricket:     ["#4a3728", "#2d2218", "🏏"],
  bowling:     ["#1a1a4a", "#0d0d2e", "🎳"],
  golf:        ["#2d5a1e", "#1a3611", "⛳"],
  volleyball:  ["#5c3a1a", "#3d2610", "🏐"],
  hockey:      ["#1a2d4a", "#0d1a2e", "🏒"],
  squash:      ["#3a1a4a", "#220d2e", "🏸"],
  baseball:    ["#4a1a1a", "#2e0d0d", "⚾"],
};

const DEFAULT_THEME: [string, string, string] = ["#1a0505", "#2d0808", "🏟️"];

export interface ShareCardProps {
  facilityName: string;
  facilityCity: string;
  sport: string;
  date: string;
  startTime: string;
  endTime: string;
  caption: string;
  showPoints: boolean;
  showTier: boolean;
  showFacility: boolean;
  totalPoints: number;
  tierName: string;
  userPhotoUri?: string | null;
}

export default function ShareCard({
  facilityName,
  facilityCity,
  sport,
  date,
  startTime,
  endTime,
  caption,
  showPoints,
  showTier,
  showFacility,
  totalPoints,
  tierName,
  userPhotoUri,
}: ShareCardProps) {
  const sportKey = sport.toLowerCase();
  const [topColor, , emoji] = SPORT_THEMES[sportKey] ?? DEFAULT_THEME;
  const sportLabel = sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();

  return (
    <View style={styles.card}>
      {userPhotoUri ? (
        <>
          <Image source={{ uri: userPhotoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.62)" }]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: topColor }]} />
      )}

      {/* Dark scrim behind logo area */}
      <View style={[StyleSheet.absoluteFill, { height: "35%", backgroundColor: "rgba(0,0,0,0.45)" }]} />

      {/* Content */}
      <View style={styles.content}>
        {/* Top: Dome logo */}
        <View style={styles.topRow}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoText}>DOME</Text>
          </View>
        </View>

        {/* Centre: Sport info */}
        <View style={styles.centreBlock}>
          <Text style={styles.sportEmoji}>{emoji}</Text>
          <Text style={styles.sportName}>{sportLabel.toUpperCase()}</Text>

          {showFacility && (
            <>
              <Text style={styles.facilityName} numberOfLines={2}>{facilityName}</Text>
              {facilityCity ? (
                <Text style={styles.facilityCity}>{facilityCity}</Text>
              ) : null}
            </>
          )}

          <View style={styles.divider} />

          <Text style={styles.dateTime}>{date}</Text>
          <Text style={styles.dateTime}>{startTime} – {endTime}</Text>
        </View>

        {/* Bottom: Caption + stats */}
        <View style={styles.bottomBlock}>
          {caption ? (
            <Text style={styles.caption} numberOfLines={3}>"{caption}"</Text>
          ) : null}

          {(showPoints || showTier) && (
            <View style={styles.statsRow}>
              {showPoints && (
                <View style={styles.statChip}>
                  <Text style={styles.statText}>⭐ {totalPoints} pts</Text>
                </View>
              )}
              {showTier && (
                <View style={styles.statChip}>
                  <Text style={styles.statText}>{tierName}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.watermark}>dome.app</Text>
        </View>
      </View>
    </View>
  );
}

// Card is 9:16 aspect — 360×640 on screen, captured at 3× = 1080×1920
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 640;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0d0d0d",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  logoWrap: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logoText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },
  centreBlock: {
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  sportEmoji: { fontSize: 64, lineHeight: 72 },
  sportName: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  facilityName: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  facilityCity: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textAlign: "center",
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: "rgba(232,80,104,0.8)",
    borderRadius: 1,
    marginVertical: 8,
  },
  dateTime: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  bottomBlock: { gap: 10 },
  caption: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 23,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  statChip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  statText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  watermark: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    textAlign: "right",
    letterSpacing: 0.5,
  },
});
