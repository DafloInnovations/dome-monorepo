import React, { useState } from "react";
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
import { router } from "expo-router";

const API_URL =
  process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

function formatDisplay(digits: string): string {
  if (digits.length < 4) return digits;
  if (digits.length < 7)
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function PhoneScreen() {
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid = digits.length === 10;

  async function handleSend() {
    if (!isValid || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed to send code");
      router.push({ pathname: "/(auth)/otp", params: { phone: digits } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Dome</Text>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          Enter your Canadian phone number to get started
        </Text>

        <View style={styles.inputWrap}>
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>🇨🇦 +1</Text>
            </View>
            <TextInput
              style={styles.input}
              value={formatDisplay(digits)}
              onChangeText={(v) =>
                setDigits(v.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="(416) 555-0100"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleSend}
              autoFocus
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnOff]}
          onPress={handleSend}
          disabled={!isValid || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Send verification code</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service and Privacy Policy.
          Standard message rates may apply.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: "center" },
  logo: { fontSize: 30, fontWeight: "800", color: "#22c55e", marginBottom: 24 },
  title: { fontSize: 32, fontWeight: "700", color: "#111827", marginBottom: 6 },
  subtitle: { fontSize: 16, color: "#6b7280", marginBottom: 32, lineHeight: 24 },
  inputWrap: { marginBottom: 20 },
  phoneRow: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  prefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#f9fafb",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    justifyContent: "center",
  },
  prefixText: { fontSize: 15, color: "#374151", fontWeight: "500" },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    color: "#111827",
  },
  error: { marginTop: 8, color: "#ef4444", fontSize: 14 },
  btn: {
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  btnOff: { backgroundColor: "#bbf7d0" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  legal: {
    textAlign: "center",
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 18,
  },
});
