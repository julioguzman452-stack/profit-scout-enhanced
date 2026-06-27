import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/src/theme";

export default function ManualSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const onSubmit = () => {
    const query = q.trim();
    if (!query) return;
    router.replace({ pathname: "/product", params: { q: query, source: "manual" } });
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <Pressable testID="manual-close" onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={s.title}>Manual search</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={s.body}>
          <Text style={s.label}>ITEM NAME OR KEYWORDS</Text>
          <TextInput
            testID="manual-search-input"
            style={s.input}
            placeholder="e.g. Sony WH-1000XM4 black"
            placeholderTextColor={colors.textSubtle}
            value={q}
            onChangeText={setQ}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={onSubmit}
          />
          <Pressable
            testID="manual-search-button"
            onPress={onSubmit}
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="search" size={18} color={colors.primaryText} />
            <Text style={s.btnText}>Check eBay comps</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  body: { padding: spacing.lg },
  label: { fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 6 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  btn: {
    marginTop: spacing.md,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  btnText: { color: colors.primaryText, fontWeight: "700", fontSize: 16 },
});
