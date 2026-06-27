import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.container}>
          <View style={s.logoWrap}>
            <View style={s.logoBadge}>
              <Ionicons name="cube-outline" size={28} color={colors.primaryText} />
            </View>
            <Text style={s.brand}>Profit Scout AI</Text>
            <Text style={s.tagline}>Scan. Check. Flip smarter.</Text>
          </View>

          <View style={s.card}>
            <Text style={s.title}>Sign in</Text>

            <Text style={s.label}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              style={s.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@reseller.com"
              placeholderTextColor={colors.textSubtle}
            />

            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              testID="login-password-input"
              style={s.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSubtle}
            />

            {error ? (
              <Text style={s.error} testID="login-error">
                {error}
              </Text>
            ) : null}

            <Pressable
              testID="login-submit-button"
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={s.primaryBtnText}>Sign in</Text>
              )}
            </Pressable>

            <Pressable
              testID="login-go-register"
              onPress={() => router.push("/(auth)/register")}
              style={s.linkRow}
            >
              <Text style={s.linkText}>
                New here? <Text style={s.linkStrong}>Create an account</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: spacing.xl },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brand: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
  linkRow: { marginTop: spacing.md, alignItems: "center" },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkStrong: { color: colors.accent, fontWeight: "700" },
  error: {
    marginTop: spacing.md,
    color: colors.bad,
    backgroundColor: colors.badBg,
    borderColor: colors.badBorder,
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    fontSize: 13,
  },
});
