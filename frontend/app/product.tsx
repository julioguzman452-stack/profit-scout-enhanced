import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type EbayData = {
  active_count: number;
  sold_count: number;
  avg_sold_price: number;
  median_sold_price: number;
  lowest_sold_price: number;
  highest_sold_price: number;
  sell_through_rate: number;
  recent_sold: { title: string; price: number; sold_days_ago: number; condition: string }[];
};

type MarketplaceData = {
  platform: string;
  query: string;
  active_count: number;
  avg_price: number;
  lowest_price: number;
  highest_price: number;
  listings: { title: string; price: number; shipping: number }[];
  data_source: string;
};

export default function ProductScreen() {
  const params = useLocalSearchParams<{ q?: string; source?: string }>();
  const q = (params.q || "").toString();
  const source = (params.source || "manual").toString();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ebay, setEbay] = useState<EbayData | null>(null);
  const [amazon, setAmazon] = useState<MarketplaceData | null>(null);
  const [mercari, setMercari] = useState<MarketplaceData | null>(null);
  const [whatnot, setWhatnot] = useState<MarketplaceData | null>(null);
  const [facebook, setFacebook] = useState<MarketplaceData | null>(null);
  const [ai, setAi] = useState<{ improved_keywords?: string[]; tips?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ ebay: EbayData; amazon: MarketplaceData; mercari: MarketplaceData; whatnot: MarketplaceData; facebook: MarketplaceData; ai: any }>("/search", {
        method: "POST",
        body: { query: q },
      });
      setEbay(r.ebay);
      setAmazon(r.amazon || null);
      setMercari(r.mercari || null);
      setWhatnot(r.whatnot || null);
      setFacebook(r.facebook || null);
      setAi(r.ai || null);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    if (q) load();
  }, [q, load]);

  const save = async () => {
    if (!ebay || saving) return;
    setSaving(true);
    try {
      await api("/history", {
        method: "POST",
        body: {
          title: q,
          query: q,
          source,
          ebay_data: ebay,
          ai_insight: ai,
          marketplace_data: { amazon, mercari, whatnot, facebook },
        },
      });
      setSaved(true);
    } catch (e: any) {
      Alert.alert("Save failed", e.message || "");
    } finally {
      setSaving(false);
    }
  };

  const openFbMarketplace = () => {
    const url = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(q)}`;
    Linking.openURL(url).catch(() => {});
  };

  const openExternal = (which: "ebay" | "amazon" | "fb" | "mercari") => {
    const encQ = encodeURIComponent(q);
    const map: Record<string, string> = {
      ebay: `https://www.ebay.com/sch/i.html?_nkw=${encQ}`,
      amazon: `https://www.amazon.com/s?k=${encQ}`,
      fb: `https://www.facebook.com/marketplace/search/?query=${encQ}`,
      mercari: `https://www.mercari.com/search/?keyword=${encQ}`,
    };
    Linking.openURL(map[which]).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable testID="product-back" onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{q}</Text>
        <Pressable testID="product-save" onPress={save} disabled={saving || saved} style={s.iconBtn}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.loadingText}>Fetching market data…</Text>
          </View>
        ) : error ? (
          <View style={s.errBox}>
            <Text style={s.errText}>{error}</Text>
            <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></Pressable>
          </View>
        ) : ebay ? (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>Price comparison</Text>
              <Text style={s.sectionSub}>Live prices across major marketplaces</Text>
              <View style={s.comparisonGrid}>
                {ebay && <ComparisonCard platform="eBay" data={{ platform: "ebay", query: q, active_count: ebay.active_count, avg_price: ebay.avg_sold_price, lowest_price: ebay.lowest_sold_price, highest_price: ebay.highest_sold_price, listings: ebay.recent_sold as any, data_source: "mock" }} />}
                {amazon && <ComparisonCard platform="Amazon" data={amazon} />}
                {mercari && <ComparisonCard platform="Mercari" data={mercari} />}
                {whatnot && <ComparisonCard platform="Whatnot" data={whatnot} />}
                {facebook && <ComparisonCard platform="Facebook" data={facebook} />}
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>eBay snapshot</Text>
              <Text style={s.sectionSub}>Detailed eBay market data</Text>
              <View style={s.kpiGrid}>
                <Kpi label="ACTIVE" value={`${ebay.active_count}`} />
                <Kpi label="SOLD" value={`${ebay.sold_count}`} />
                <Kpi label="SELL-THROUGH" value={`${ebay.sell_through_rate}%`} />
              </View>
              <View style={s.kpiGrid}>
                <Kpi label="AVG SOLD" value={`$${ebay.avg_sold_price}`} />
                <Kpi label="LOW" value={`$${ebay.lowest_sold_price}`} />
                <Kpi label="HIGH" value={`$${ebay.highest_sold_price}`} />
              </View>
            </View>

            <View style={s.section}>
              <View style={s.rowBetween}>
                <Text style={s.sectionTitle}>AI insight</Text>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
              </View>
              {ai?.improved_keywords?.length ? (
                <>
                  <Text style={s.subLabel}>Better keywords</Text>
                  <View style={s.chipRow}>
                    {ai.improved_keywords.map((k, i) => (
                      <View key={`${k}-${i}`} style={s.chip}>
                        <Text style={s.chipText}>{k}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={s.muted}>No AI suggestions.</Text>
              )}
              {ai?.tips?.length ? (
                <>
                  <Text style={[s.subLabel, { marginTop: spacing.sm }]}>Tips</Text>
                  {ai.tips.map((t, i) => (
                    <View key={i} style={s.tipRow}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.good} />
                      <Text style={s.tipText}>{t}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Recent sold</Text>
              <Text style={s.sectionSub}>Recent eBay sales</Text>
              {ebay.recent_sold.slice(0, 6).map((r, i) => (
                <View key={i} style={s.soldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.soldTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={s.soldMeta}>{r.condition} · {r.sold_days_ago}d ago</Text>
                  </View>
                  <Text style={s.soldPrice}>${r.price}</Text>
                </View>
              ))}
            </View>

            <View style={s.actionRow}>
              <Pressable
                testID="product-add-to-inventory"
                style={s.actionBtn}
                onPress={() => router.push({ pathname: "/inventory/new", params: { prefill: q } })}
              >
                <Ionicons name="add-circle" size={18} color={colors.primaryText} />
                <Text style={s.actionText}>Add to inventory</Text>
              </Pressable>
              <Pressable
                testID="product-go-calculator"
                style={[s.actionBtn, { backgroundColor: colors.accent }]}
                onPress={() => router.push({ pathname: "/calculator", params: { q } })}
              >
                <Ionicons name="calculator" size={18} color={colors.primaryText} />
                <Text style={s.actionText}>Profit calc</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
    </View>
  );
}

function ComparisonCard({ platform, data }: { platform: string; data: MarketplaceData }) {
  return (
    <View style={s.compCard}>
      <Text style={s.compPlatform}>{platform}</Text>
      <View style={s.compPrices}>
        <View style={s.compPrice}>
          <Text style={s.compLabel}>LOW</Text>
          <Text style={s.compValue}>${data.lowest_price}</Text>
        </View>
        <View style={s.compPrice}>
          <Text style={s.compLabel}>AVG</Text>
          <Text style={s.compValue}>${data.avg_price}</Text>
        </View>
        <View style={s.compPrice}>
          <Text style={s.compLabel}>HIGH</Text>
          <Text style={s.compValue}>${data.highest_price}</Text>
        </View>
      </View>
      <Text style={s.compCount}>{data.active_count} listings</Text>
    </View>
  );
}

function MpBtn({ testID, icon, label, bg, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [{
      width: "48.5%",
      backgroundColor: bg,
      borderRadius: radius.md,
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      opacity: pressed ? 0.85 : 1,
    }]}>
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  loading: { alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  errBox: { padding: spacing.lg, gap: spacing.md, alignItems: "center" },
  errText: { color: colors.bad, textAlign: "center" },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  retryText: { color: colors.primaryText, fontWeight: "700" },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  sectionSub: { fontSize: 11, color: colors.textMuted },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginTop: 4 },
  kpiGrid: { flexDirection: "row", gap: spacing.sm },
  kpi: { flex: 1, backgroundColor: "#f1f5f9", borderRadius: radius.md, padding: spacing.sm },
  kpiLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
  kpiValue: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: "#eff6ff", borderRadius: radius.pill, borderWidth: 1, borderColor: "#bfdbfe" },
  chipText: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 12 },
  tipRow: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 4 },
  tipText: { flex: 1, fontSize: 12, color: colors.text },
  soldRow: { flexDirection: "row", paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, alignItems: "center" },
  soldTitle: { fontSize: 13, color: colors.text, fontWeight: "600" },
  soldMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  soldPrice: { fontSize: 14, fontWeight: "800", color: colors.text },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  actionText: { color: colors.primaryText, fontWeight: "700" },
  mockBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.warnBg,
    borderColor: colors.warnBorder,
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  mockBannerText: { flex: 1, color: "#7c5e0a", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  mpGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  comingRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  comingPill: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: "#f1f5f9" },
  comingText: { fontSize: 10, color: colors.textMuted, fontWeight: "700" },
  comparisonGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  compCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "#f1f5f9",
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compPlatform: { fontSize: 12, fontWeight: "800", color: colors.text, marginBottom: spacing.xs },
  compPrices: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  compPrice: { flex: 1, alignItems: "center" },
  compLabel: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  compValue: { fontSize: 13, fontWeight: "800", color: colors.accent, marginTop: 2 },
  compCount: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
});
