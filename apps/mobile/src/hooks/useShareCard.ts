import { useCallback, useState } from "react";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export function useShareCard() {
  const { getValidToken } = useAuthToken();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const pickPhoto = useCallback(async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow Dome to access your photos to add a background image.",
        [{ text: "OK" }]
      );
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  }, []);

  const saveToPhotos = useCallback(async (fileUri: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow Dome to save to your Photos library.",
          [{ text: "OK" }]
        );
        return false;
      }
      await MediaLibrary.saveToLibraryAsync(fileUri);
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  const shareGeneral = useCallback(async (fileUri: string) => {
    setSharing(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Sharing not available", "Your device doesn't support sharing.");
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: "image/png",
        dialogTitle: "Share your game",
      });
    } finally {
      setSharing(false);
    }
  }, []);

  const shareToInstagram = useCallback(async (fileUri: string) => {
    await shareGeneral(fileUri);
  }, [shareGeneral]);

  const shareToWhatsApp = useCallback(async (fileUri: string) => {
    await shareGeneral(fileUri);
  }, [shareGeneral]);

  const logShare = useCallback(async (
    bookingId: string,
    platform: "instagram" | "whatsapp" | "other"
  ): Promise<{ pointsAwarded: number } | null> => {
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/bookings/${bookingId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data: { pointsAwarded: number } };
      return json.data;
    } catch {
      return null;
    }
  }, [getValidToken]);

  return { saving, sharing, pickPhoto, saveToPhotos, shareGeneral, shareToInstagram, shareToWhatsApp, logShare };
}
