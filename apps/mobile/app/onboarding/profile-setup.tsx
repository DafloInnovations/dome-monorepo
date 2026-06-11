"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { useAuthToken } from "../../src/hooks/useAuthToken";
import { CANADIAN_CITIES } from "../../src/config/canadianCities";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";
const STORAGE_KEY = "dome_profile_setup_progress";

const C = {
  bg:      "#FFFFFF",
  primary: "#E85068",
  surface: "#FAFAFA",
  text:    "#0A0A0A",
  muted:   "#9E9E9E",
  border:  "#E8E8E8",
};

const SPORTS = [
  { key: "BADMINTON",  label: "Badminton",  emoji: "🏸" },
  { key: "TENNIS",     label: "Tennis",     emoji: "🎾" },
  { key: "PICKLEBALL", label: "Pickleball", emoji: "🏓" },
  { key: "BASKETBALL", label: "Basketball", emoji: "🏀" },
  { key: "SOCCER",     label: "Soccer",     emoji: "⚽" },
  { key: "VOLLEYBALL", label: "Volleyball", emoji: "🏐" },
  { key: "HOCKEY",     label: "Hockey",     emoji: "🏒" },
  { key: "CRICKET",    label: "Cricket",    emoji: "🏏" },
  { key: "BASEBALL",   label: "Baseball",   emoji: "⚾" },
];

const GENDERS = [
  { key: "MALE",       label: "Male"       },
  { key: "FEMALE",     label: "Female"     },
  { key: "OTHER",      label: "Other"      },
  { key: "PREFER_NOT", label: "Prefer not" },
];

interface FormData {
  firstName:       string;
  lastName:        string;
  email:           string;
  dateOfBirth:     string;
  gender:          string;
  city:            string;
  province:        string;
  preferredSports: string[];
}

const EMPTY_FORM: FormData = {
  firstName: "", lastName: "", email: "",
  dateOfBirth: "", gender: "", city: "", province: "",
  preferredSports: [],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${(step / total) * 100}%` as `${number}%` }]} />
    </View>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i < current && styles.dotFilled]} />
      ))}
    </View>
  );
}

function Label({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <Text style={styles.label}>
      {text}{optional ? <Text style={styles.optional}> (optional)</Text> : null}
    </Text>
  );
}

function Field({
  label, optional, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string; optional?: boolean; value: string;
  onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Label text={label} optional={optional} />
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function Step1({
  data, onChange, onContinue, isEditMode,
}: {
  data: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  onContinue: () => void;
  isEditMode: boolean;
}) {
  const canContinue = data.firstName.trim().length >= 2 && data.lastName.trim().length >= 2;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stepContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isEditMode && (
          <View style={styles.stepHeader}>
            <Text style={styles.stepEmoji}>🏸</Text>
            <Text style={styles.stepTitle}>Welcome to Dome!</Text>
            <Text style={styles.stepSubtitle}>Let's set up your profile</Text>
          </View>
        )}

        <Field
          label="FIRST NAME"
          value={data.firstName}
          onChangeText={(v) => onChange("firstName", v)}
          placeholder="Enter first name"
          autoCapitalize="words"
        />
        <Field
          label="LAST NAME"
          value={data.lastName}
          onChangeText={(v) => onChange("lastName", v)}
          placeholder="Enter last name"
          autoCapitalize="words"
        />
        <Field
          label="EMAIL"
          optional
          value={data.email}
          onChangeText={(v) => onChange("email", v)}
          placeholder="For booking receipts"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="DATE OF BIRTH"
          optional
          value={data.dateOfBirth}
          onChangeText={(v) => onChange("dateOfBirth", v)}
          placeholder="YYYY-MM-DD"
          keyboardType="numeric"
        />

        <View style={styles.fieldWrap}>
          <Label text="GENDER" optional />
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <Pressable
                key={g.key}
                style={[styles.genderPill, data.gender === g.key && styles.genderPillSel]}
                onPress={() => onChange("gender", data.gender === g.key ? "" : g.key)}
              >
                <Text style={[styles.genderPillText, data.gender === g.key && styles.genderPillTextSel]}>
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {!isEditMode && (
          <Pressable
            style={[styles.btn, !canContinue && styles.btnDisabled]}
            onPress={onContinue}
            disabled={!canContinue}
          >
            <Text style={styles.btnText}>Continue →</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step2({
  data, onChange, onContinue, isEditMode,
}: {
  data: FormData;
  onChange: (city: string, province: string) => void;
  onContinue: () => void;
  isEditMode: boolean;
}) {
  const canContinue = !!data.city;

  return (
    <View>
      {!isEditMode && (
        <View style={styles.stepHeader}>
          <Text style={styles.stepEmoji}>📍</Text>
          <Text style={styles.stepTitle}>Where are you based?</Text>
        </View>
      )}
      {isEditMode && <Label text="CITY" />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.cityScrollOuter}
        contentContainerStyle={styles.cityGrid}
        nestedScrollEnabled
      >
        {CANADIAN_CITIES.map((c) => {
          const sel = data.city === c.name;
          return (
            <Pressable
              key={c.name}
              style={[styles.cityPill, sel && styles.cityPillSel]}
              onPress={() => onChange(c.name, c.province)}
            >
              <Text style={[styles.cityPillText, sel && styles.cityPillTextSel]}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {data.city ? (
        <Text style={styles.citySelected}>
          📍 {data.city}, {data.province}
        </Text>
      ) : (
        <Text style={styles.cityHint}>Tap a city to select it</Text>
      )}

      {!isEditMode && (
        <Pressable
          style={[styles.btn, styles.btnBottom, !canContinue && styles.btnDisabled]}
          onPress={onContinue}
          disabled={!canContinue}
        >
          <Text style={styles.btnText}>Continue →</Text>
        </Pressable>
      )}
    </View>
  );
}

function Step3({
  data, onChange, onComplete, saving, isEditMode,
}: {
  data: FormData;
  onChange: (sports: string[]) => void;
  onComplete: () => void;
  saving: boolean;
  isEditMode: boolean;
}) {
  const canComplete = data.preferredSports.length > 0;

  function toggleSport(key: string) {
    const next = data.preferredSports.includes(key)
      ? data.preferredSports.filter((s) => s !== key)
      : [...data.preferredSports, key];
    onChange(next);
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      {!isEditMode && (
        <View style={styles.stepHeader}>
          <Text style={styles.stepEmoji}>🎾</Text>
          <Text style={styles.stepTitle}>What do you play?</Text>
          <Text style={styles.stepSubtitle}>Select all that apply</Text>
        </View>
      )}
      {isEditMode && <Label text="PREFERRED SPORTS" />}

      <View style={styles.sportsGrid}>
        {SPORTS.map((s) => {
          const sel = data.preferredSports.includes(s.key);
          return (
            <Pressable
              key={s.key}
              style={[styles.sportCard, sel && styles.sportCardSel]}
              onPress={() => toggleSport(s.key)}
            >
              <Text style={styles.sportEmoji}>{s.emoji}</Text>
              <Text style={[styles.sportLabel, sel && styles.sportLabelSel]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!canComplete && (
        <Text style={styles.sportHint}>Select at least 1 sport</Text>
      )}

      {!isEditMode && (
        <Pressable
          style={[styles.btn, (!canComplete || saving) && styles.btnDisabled]}
          onPress={onComplete}
          disabled={!canComplete || saving}
        >
          <Text style={styles.btnText}>
            {saving ? "Setting up…" : "Complete Setup 🎉"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function CompletionScreen({ firstName, onStart }: { firstName: string; onStart: () => void }) {
  return (
    <View style={styles.completionWrap}>
      <Text style={styles.completionEmoji}>🎉</Text>
      <Text style={styles.completionTitle}>
        You're all set{firstName ? `, ${firstName}` : ""}!
      </Text>
      <Text style={styles.completionSub}>
        Ready to find courts and connect with players?
      </Text>
      <Pressable style={styles.btn} onPress={onStart}>
        <Text style={styles.btnText}>Start Playing →</Text>
      </Pressable>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = mode === "edit";

  const { user, updateUser } = useAuth();
  const { getValidToken } = useAuthToken();

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const savedRef = useRef(false);

  // ── Auth guard — redirect to login if no session ──────────────────────────
  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/phone");
    }
  }, [user, router]);

  // ── Restore progress or pre-fill edit mode ───────────────────────────────
  useEffect(() => {
    if (isEditMode) {
      setForm({
        firstName:       user?.firstName ?? "",
        lastName:        user?.lastName  ?? "",
        email:           "",
        dateOfBirth:     "",
        gender:          "",
        city:            "",
        province:        "",
        preferredSports: [],
      });
      return;
    }
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<FormData>;
        setForm((prev) => ({ ...prev, ...saved }));
        if (saved.city) setStep(3);
        else if (saved.firstName && saved.lastName) setStep(2);
      } catch { /* ignore */ }
    });
  }, [isEditMode, user]);

  // ── Block hardware back on Android (onboarding mode only) ────────────────
  useFocusEffect(
    useCallback(() => {
      if (isEditMode) return;
      const handler = () => {
        if (step > 1) { setStep((s) => s - 1); return true; }
        Alert.alert(
          "Skip setup?",
          "You can complete your profile later from Settings.",
          [
            { text: "Stay", style: "cancel" },
            { text: "Skip for now", style: "destructive", onPress: () => router.replace("/(tabs)") },
          ]
        );
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", handler);
      return () => sub.remove();
    }, [isEditMode, step, router])
  );

  function saveProgress(updated: FormData) {
    if (!isEditMode) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => null);
    }
  }

  function setField(key: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      saveProgress(next);
      return next;
    });
  }

  function setSports(sports: string[]) {
    setForm((prev) => {
      const next = { ...prev, preferredSports: sports };
      saveProgress(next);
      return next;
    });
  }

  function setCity(city: string, province: string) {
    setForm((prev) => {
      const next = { ...prev, city, province };
      saveProgress(next);
      return next;
    });
  }

  async function submit() {
    if (savedRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getValidToken();
      const body = {
        firstName:       form.firstName.trim(),
        lastName:        form.lastName.trim(),
        email:           form.email.trim() || undefined,
        dateOfBirth:     form.dateOfBirth || undefined,
        gender:          form.gender     || undefined,
        city:            form.city,
        province:        form.province,
        preferredSports: form.preferredSports,
      };
      const res = await fetch(`${API_URL}/users/me/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      await updateUser({
        firstName:       form.firstName.trim(),
        lastName:        form.lastName.trim(),
        profileComplete: true,
      });
      await AsyncStorage.removeItem(STORAGE_KEY);
      savedRef.current = true;
      if (isEditMode) {
        router.back();
      } else {
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Edit mode: single-screen with all fields ──────────────────────────────
  if (isEditMode) {
    const canSave =
      form.firstName.trim().length >= 2 &&
      form.lastName.trim().length >= 2 &&
      !!form.city &&
      form.preferredSports.length > 0;

    return (
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.editHeader}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.editBack}>← Back</Text>
          </Pressable>
          <Text style={styles.editTitle}>Edit Profile</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.stepContent, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Step1 data={form} onChange={setField} onContinue={() => {}} isEditMode />
          <Step2 data={form} onChange={setCity} onContinue={() => {}} isEditMode />
          <Step3 data={form} onChange={setSports} onComplete={submit} saving={saving} isEditMode />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.btn, (!canSave || saving) && styles.btnDisabled, { marginTop: 24 }]}
            onPress={submit}
            disabled={!canSave || saving}
          >
            <Text style={styles.btnText}>{saving ? "Saving…" : "Save Changes"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Completion screen ─────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom + 24 }]}>
        <CompletionScreen
          firstName={form.firstName}
          onStart={() => router.replace("/(tabs)")}
        />
      </View>
    );
  }

  // ── Onboarding multi-step ─────────────────────────────────────────────────
  const TOTAL_STEPS = 3;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <ProgressBar step={step} total={TOTAL_STEPS} />
        <View style={styles.headerRow}>
          {step > 1 ? (
            <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={12}>
              <Text style={styles.backBtn}>←</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Skip setup?",
                  "You can complete your profile later from Settings.",
                  [
                    { text: "Stay", style: "cancel" },
                    { text: "Skip for now", style: "destructive", onPress: () => router.replace("/(tabs)") },
                  ]
                )
              }
              hitSlop={12}
            >
              <Text style={styles.skipBtn}>Skip</Text>
            </Pressable>
          )}
          <StepDots current={step} total={TOTAL_STEPS} />
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Step content */}
      <View style={[styles.body, { paddingBottom: insets.bottom + 16 }]}>
        {step === 1 && (
          <Step1
            data={form}
            onChange={setField}
            onContinue={() => { Keyboard.dismiss(); setStep(2); }}
            isEditMode={false}
          />
        )}
        {step === 2 && (
          <Step2
            data={form}
            onChange={setCity}
            onContinue={() => setStep(3)}
            isEditMode={false}
          />
        )}
        {step === 3 && (
          <>
            <Step3
              data={form}
              onChange={setSports}
              onComplete={submit}
              saving={saving}
              isEditMode={false}
            />
            {error && <Text style={[styles.error, { paddingHorizontal: 24 }]}>{error}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: C.bg },
  header:    { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  body:      { flex: 1, paddingHorizontal: 24 },

  progressTrack: { height: 4, backgroundColor: "#F0F0F0", borderRadius: 2 },
  progressFill:  { height: 4, backgroundColor: C.primary, borderRadius: 2 },
  dots:          { flexDirection: "row", gap: 6 },
  dot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E8E8E8" },
  dotFilled:     { backgroundColor: C.primary },

  backBtn: { fontSize: 22, color: C.primary, fontWeight: "600", width: 40 },
  skipBtn: { fontSize: 14, color: C.muted, fontWeight: "600", width: 40 },

  stepContent: { paddingTop: 8, paddingBottom: 32, gap: 4 },
  stepHeader:  { alignItems: "center", marginBottom: 24, gap: 4 },
  stepEmoji:   { fontSize: 44, marginBottom: 4 },
  stepTitle:   { fontSize: 24, fontWeight: "800", color: C.text, textAlign: "center" },
  stepSubtitle: { fontSize: 15, color: C.muted, textAlign: "center" },

  fieldWrap: { marginTop: 16 },
  label:     { fontSize: 11, fontWeight: "700", color: C.muted, letterSpacing: 0.8, marginBottom: 6 },
  optional:  { color: "#C0C0C0", fontWeight: "400" },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    backgroundColor: C.surface, color: C.text,
  },
  inputFocused: { borderColor: C.primary },

  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  genderPill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg,
  },
  genderPillSel:     { borderColor: C.primary, backgroundColor: "#FFF5F7" },
  genderPillText:    { fontSize: 13, color: C.muted, fontWeight: "600" },
  genderPillTextSel: { color: C.primary },

  cityScrollOuter: { maxHeight: 260, marginVertical: 8 },
  cityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 4,
  },
  cityPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
    backgroundColor: "#F5F5F5",
  },
  cityPillSel:     { backgroundColor: C.primary },
  cityPillText:    { fontSize: 13, color: C.text, fontWeight: "600" },
  cityPillTextSel: { color: "#FFFFFF" },
  citySelected:    { fontSize: 14, color: C.primary, fontWeight: "700", textAlign: "center", marginTop: 6 },
  cityHint:        { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 6 },

  sportsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  sportCard: {
    width: "30%", aspectRatio: 1, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.border, backgroundColor: C.bg,
    gap: 4,
  },
  sportCardSel:  { borderColor: C.primary, backgroundColor: "#FFF5F7" },
  sportEmoji:    { fontSize: 28 },
  sportLabel:    { fontSize: 11, fontWeight: "700", color: C.muted, textAlign: "center" },
  sportLabelSel: { color: C.primary },
  sportHint:     { fontSize: 12, color: C.muted, textAlign: "center", marginTop: 8 },

  btn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginTop: 24,
  },
  btnBottom:   { marginHorizontal: 0, marginTop: "auto" },
  btnDisabled: { opacity: 0.45 },
  btnText:     { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },

  completionWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 12,
  },
  completionEmoji: { fontSize: 64, marginBottom: 8 },
  completionTitle: { fontSize: 26, fontWeight: "800", color: C.text, textAlign: "center" },
  completionSub:   { fontSize: 16, color: C.muted, textAlign: "center", lineHeight: 24 },

  editHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  editBack:  { fontSize: 16, color: C.primary, fontWeight: "600" },
  editTitle: { fontSize: 17, fontWeight: "800", color: C.text },

  error: { color: "#EF4444", fontSize: 13, textAlign: "center", marginTop: 8 },
});
