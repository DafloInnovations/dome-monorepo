import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import type { AuthUser } from "../../src/context/AuthContext";

const API_URL =
  process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { setSession } = useAuth();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(30);
  const inputRef = useRef<TextInput>(null);

  const formattedPhone = phone
    ? `+1 (${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
    : "";

  // Countdown for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6) verify();
  }, [code]);

  async function verify() {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const json = (await res.json()) as {
        data?: {
          accessToken: string;
          refreshToken: string;
          user: AuthUser & { isNewUser: boolean };
        };
        message?: string;
      };
      if (!res.ok) throw new Error(json.message ?? "Verification failed");
      const { accessToken, refreshToken, user } = json.data!;
      await setSession(accessToken, refreshToken, {
        id: user.id,
        phone: user.phone,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      router.replace("/(tabs)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed to resend");
      setCode("");
      setCooldown(30);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{"\n"}
          <Text style={styles.phone}>{formattedPhone}</Text>
        </Text>

        {/* OTP boxes — tap area focuses the hidden input */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          <View style={styles.boxes}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  code.length === i && styles.boxCursor,
                  code.length > i && styles.boxFilled,
                ]}
              >
                {loading && code.length > i ? (
                  <ActivityIndicator size="small" color="#22c55e" />
                ) : (
                  <Text style={styles.boxDigit}>{code[i] ?? ""}</Text>
                )}
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* Hidden keyboard driver */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.hidden}
          autoFocus
          caretHidden
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.resendRow}>
          {cooldown > 0 ? (
            <Text style={styles.cooldownText}>
              Resend code in{" "}
              <Text style={styles.cooldownNum}>{cooldown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={resend} disabled={resending}>
              <Text style={styles.resendBtn}>
                {resending ? "Sending…" : "Resend code"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const GREEN = "#22c55e";
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 64 },
  back: { marginBottom: 32 },
  backText: { fontSize: 16, color: GREEN, fontWeight: "600" },
  title: { fontSize: 32, fontWeight: "700", color: "#111827", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#6b7280", lineHeight: 26, marginBottom: 36 },
  phone: { fontWeight: "600", color: "#111827" },

  boxes: { flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 12 },
  box: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  boxCursor: { borderColor: GREEN, backgroundColor: "#fff" },
  boxFilled: { borderColor: GREEN, backgroundColor: "#f0fdf4" },
  boxDigit: { fontSize: 24, fontWeight: "700", color: "#111827" },

  hidden: { position: "absolute", width: 0, height: 0, opacity: 0 },
  error: { textAlign: "center", color: "#ef4444", fontSize: 14, marginTop: 6 },

  resendRow: { alignItems: "center", marginTop: 28 },
  cooldownText: { fontSize: 15, color: "#9ca3af" },
  cooldownNum: { fontWeight: "600" },
  resendBtn: { fontSize: 15, color: GREEN, fontWeight: "600" },
});
