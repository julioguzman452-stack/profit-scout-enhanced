import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { usePrefs } from "@/src/context/PrefsContext";
import { useAuth } from "@/src/context/AuthContext";
import { radius, spacing } from "@/src/theme";

type Stats = {
  total_revenue: number;
  total_profit: number;
  roi_pct: number;
  inventory_value: number;
  active_listings: number;
  items_sold: number;
  in_stock: number;
  best_category: string;
  best_source: string;
};

export default function Home() {
  const router = useRouter();
  const { colors, symbol } = usePrefs();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Stats>("/stats/home");
      setStats(r);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const s = makeStyles(colors);
  const profitColor =
    !stats ? colors.text : stats.total_profit > 0 ? colors.good : stats.total_profit < 0 ? colors.bad : colors.text;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.text}
          />
        }
      >
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.brand}>Profit Scout AI</Text>
            <Text style={s.sub}>{user?.email}</Text>
          </View>
        </View>

        {loading && !stats ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={s.heroCard}>
              <Text style={s.heroLabel}>TOTAL PROFIT</Text>
              <Text style={[s.heroValue, { color: profitColor }]} testID="kpi-total-profit">
                {symbol}{stats?.total_profit?.toFixed(2) ?? "0.00"}
              </Text>
              <View style={s.heroRow}>
                <HeroCell label="REVENUE" value={`${symbol}${stats?.total_revenue?.toFixed(2) ?? "0.00"}`} colors={colors} />
                <HeroCell label="ROI" value={`${stats?.roi_pct ?? 0}%`} colors={colors} />
                <HeroCell label="INV VALUE" value={`${symbol}${stats?.inventory_value?.toFixed(2) ?? "0.00"}`} colors={colors} />
              </View>
            </View>

            <View style={s.kpiGrid}>
              <KpiCard testID="kpi-active" icon="megaphone" label="Active listings" value={`${stats?.active_listings ?? 0}`} colors={colors} />
              <KpiCard testID="kpi-sold" icon="cash" label="Items sold" value={`${stats?.items_sold ?? 0}`} colors={colors} />
              <KpiCard testID="kpi-stock" icon="archive" label="In stock" value={`${stats?.in_stock ?? 0}`} colors={colors} />
              <KpiCard testID="kpi-best-cat" icon="ribbon" label="Best category" value={stats?.best_category || "—"} colors={colors} small />
              <KpiCard testID="kpi-best-src" icon="trophy" label="Best source" value={stats?.best_source || "—"} colors={colors} small />
              <KpiCard
                testID="kpi-history"
                icon="time"
                label="Scan history"
                value="View"
                colors={colors}
                small
                onPress={() => router.push("/history")}
              />
            </View>
          </>
        )}

        <Pressable
          testID="home-scan-barcode-cta"
          style={({ pressed }) => [s.primaryCta, pressed && { opacity: 0.9 }]}
          onPress={() => router.push("/scan/barcode")}
        >
          <Ionicons name="barcode-outline" size={28} color={colors.primaryText} />
          <View style={{ flex: 1 }}>
            <Text style={s.primaryCtaTitle}>Scan barcode</Text>
            <Text style={s.primaryCtaSub}>Instant comp lookup + Profit Score</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.primaryText} />
        </Pressable>

        <View style={s.tileGrid}>
          <Tile testID="home-camera-ai" icon="camera" label="Camera AI" hint="Snap & identify" onPress={() => router.push("/scan/camera")} colors={colors} />
          <Tile testID="home-manual-search" icon="search" label="Manual search" hint="Type item name" onPress={() => router.push("/scan/manual")} colors={colors} />
          <Tile testID="home-profit-calc" icon="calculator" label="Profit calc" hint="With Profit Score" onPress={() => router.push("/calculator")} colors={colors} />
          <Tile testID="home-fb" icon="storefront" label="FB Marketplace" hint="Local comps" onPress={() => router.push("/fb-marketplace")} colors={colors} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroCell({ label, value, colors }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", padding: 10, borderRadius: 10 }}>
      <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: "800", marginTop: 4 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function KpiCard({ icon, label, value, colors, small, onPress, testID }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={{
        width: "31.5%",
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={{ color: colors.textMuted, fontSize: 10, letterSpacing: 0.8, marginTop: spacing.sm, fontWeight: "700" }}>
        {String(label).toUpperCase()}
      </Text>
      <Text
        style={{ color: colors.text, fontSize: small ? 13 : 18, fontWeight: "800", marginTop: 2 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function Tile({ icon, label, hint, onPress, colors, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [{
      width: "48.5%",
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    }, pressed && { opacity: 0.85 }]}>
      <View style={{
        width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.cardAlt,
        alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
      }}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </View>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{hint}</Text>
    </Pressable>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
    brand: { fontSize: 26, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
    sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    heroCard: { backgroundColor: c.primary, borderRadius: radius.lg, padding: spacing.lg },
    heroLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
    heroValue: { fontSize: 36, fontWeight: "900", marginTop: 4 },
    heroRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    primaryCta: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    primaryCtaTitle: { color: c.primaryText, fontSize: 18, fontWeight: "800" },
    primaryCtaSub: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },
    tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  });
