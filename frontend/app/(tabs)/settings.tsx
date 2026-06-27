import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { usePrefs } from "@/src/context/PrefsContext";
import { CURRENCIES, radius, spacing } from "@/src/theme";

export default function Settings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors, mode, setMode, currency, setCurrency, notificationsEnabled, setNotificationsEnabled, symbol } = usePrefs();
  const [exporting, setExporting] = useState(false);

  const s = makeStyles(colors);

  const onExport = async () => {
    setExporting(true);
    try {
      const r = await api<{ csv: string; count: number; filename: string }>("/inventory/export");
      if (!r.csv) {
        Alert.alert("Nothing to export", "Add inventory items first.");
        return;
      }
      try {
        await Share.share({ message: r.csv, title: r.filename });
      } catch {
        await Clipboard.setStringAsync(r.csv);
        Alert.alert("CSV copied", `${r.count} item(s) exported. Paste into a spreadsheet.`);
      }
    } catch (e: any) {
      Alert.alert("Export failed", e.message || "");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
          <Text style={s.sub}>{user?.email}</Text>
        </View>

        <Section title="Appearance" colors={colors}>
          <Row label="THEME" colors={colors}>
            <View style={s.segmented}>
              {(["light", "dark"] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`theme-${m}`}
                  onPress={() => setMode(m)}
                  style={[
                    s.segment,
                    mode === m && { backgroundColor: colors.primary },
                  ]}
                >
                  <Ionicons
                    name={m === "dark" ? "moon" : "sunny"}
                    size={14}
                    color={mode === m ? colors.primaryText : colors.text}
                  />
                  <Text style={[s.segmentText, mode === m && { color: colors.primaryText }]}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Row>

          <Row label="CURRENCY" colors={colors}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {CURRENCIES.map((c) => (
                <Pressable
                  key={c.code}
                  testID={`currency-${c.code}`}
                  onPress={() => setCurrency(c.code)}
                  style={[
                    s.chip,
                    currency === c.code && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[s.chipText, currency === c.code && { color: colors.primaryText }]}>
                    {c.symbol} {c.code}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Row>

          <Row label="NOTIFICATIONS" colors={colors}>
            <Switch
              testID="notif-toggle"
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ true: colors.accent, false: colors.cardAlt }}
            />
          </Row>
        </Section>

        <Section title="Data" colors={colors}>
          <Action
            testID="settings-export"
            icon="download"
            label="Export inventory CSV"
            hint={exporting ? "Exporting…" : "Share or copy to clipboard"}
            onPress={onExport}
            colors={colors}
          />
          <Action
            testID="settings-history"
            icon="time"
            label="Scan history"
            hint="Past searches & scans"
            onPress={() => router.push("/history")}
            colors={colors}
          />
          <Action
            testID="settings-calculator"
            icon="calculator"
            label="Profit calculator"
            hint={`Live ${symbol} verdict + Profit Scout Score`}
            onPress={() => router.push("/calculator")}
            colors={colors}
          />
          <Action
            testID="settings-fb"
            icon="storefront"
            label="Facebook Marketplace comps"
            hint="Local price comparison"
            onPress={() => router.push("/fb-marketplace")}
            colors={colors}
          />
        </Section>

        <Section title="About" colors={colors}>
          <Info label="App" value="Profit Scout AI v1.0 MVP" colors={colors} />
          <Info label="AI" value="Gemini 3.1 Pro Preview" colors={colors} />
          <Info label="eBay data" value="MOCK (wire API later)" colors={colors} />
          <Info label="Storage" value="MongoDB · JWT auth" colors={colors} />
        </Section>

        <Pressable
          testID="settings-signout"
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/login");
          }}
          style={s.signOut}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.bad} />
          <Text style={[s.signOutText, { color: colors.bad }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, colors, children }: any) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.2, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function Row({ label, children, colors }: any) {
  return (
    <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm }}>
      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

function Action({ icon, label, hint, onPress, colors, testID }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function Info({ label, value, colors }: any) {
  return (
    <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 13, color: colors.text, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    header: { marginBottom: spacing.lg },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    segmented: { flexDirection: "row", gap: spacing.sm },
    segment: {
      flex: 1,
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      backgroundColor: c.cardAlt,
      borderRadius: radius.md,
    },
    segmentText: { fontSize: 13, fontWeight: "700", color: c.text },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
      flexShrink: 0,
    },
    chipText: { fontSize: 12, fontWeight: "700", color: c.text },
    signOut: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: c.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.badBorder,
    },
    signOutText: { fontWeight: "700", fontSize: 15 },
  });
