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

type EbayListing = {
  title: string;
  price: number;
  currency: string;
  shipping: number;
  condition: string;
  seller: string;
  url: string;
  image?: string;
};

type EbayData = {
  available: boolean;
  query: string;
  active_count: number;
  sample_count?: number;
  avg_price: number;
  median_price: number;
  lowest_price: number;
  highest_price: number;
  listings: EbayListing[];
  data_source: string;
  marketplace?: string;
  message?: string;
};

type AiInsight = {
  verdict: "BUY" | "MAYBE BUY" | "AVOID";
  risk_level: "Low" | "Medium" | "High";
  sell_through_recommendation: string;
  reasoning: string;
  expected_sale_price: number;
  estimated_low: number;
  estimated_high: number;
  expected_profit: number;
  roi_pct: number;
  ebay_fee_estimated: number;
  based_on: string;
  sample_size: number;
};

type MarketplaceLinks = {
  ebay: string;
  ebay_active: string;
  amazon: string;
  facebook: string;
  mercari: string;
  whatnot: string;
};

type SearchResp = {
  query: string;
  ebay: EbayData | null;
  pricing_available: boolean;
  pricing_message: string;
  ai_insight: AiInsight | null;
  marketplace_links: MarketplaceLinks;
};

export default function ProductScreen() {
  const params = useLocalSearchParams<{ q?: string; source?: string }>();
  const q = (params.q || "").toString();
  const source = (params.source || "manual").toString();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResp | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<SearchResp>("/search", {
        method: "POST",
        body: { query: q },
        timeoutMs: 45_000,
      });
      setData(r);
    } catch (e: any) {
      const msg = typeof e?.detail === "string" ? e.detail : (e?.message || "Failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    if (q) load();
  }, [q, load]);

  const save = async () => {
    if (!data || saving) return;
    setSaving(true);
    try {
      await api("/history", {
        method: "POST",
        body: {
          title: q,
          query: q,
          source,
          ebay_data: data.ebay,
          ai_insight: data.ai_insight,
        },
      });
      setSaved(true);
    } catch (e: any) {
      const msg = typeof e?.detail === "string" ? e.detail : (e?.message || "");
      Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const openLink = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert("Cannot open link"));
  };

  const ebay = data?.ebay || null;
  const ai = data?.ai_insight || null;
  const links = data?.marketplace_links;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable testID="product-back" onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{q}</Text>
        <Pressable testID="product-save" onPress={save} disabled={saving || saved || !data} style={s.iconBtn}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.loadingText}>Fetching live market data…</Text>
          </View>
        ) : error ? (
          <View style={s.errBox}>
            <Ionicons name="alert-circle" size={32} color={colors.bad} />
            <Text style={s.errText}>{error}</Text>
            <Pressable onPress={load} style={s.retryBtn}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : data ? (
          <>
            {/* eBay snapshot or unavailable banner */}
            {data.pricing_available && ebay ? (
              <View style={s.section}>
                <View style={s.rowBetween}>
                  <Text style={s.sectionTitle}>eBay live snapshot</Text>
                  <View style={s.livePill}>
                    <View style={s.liveDot} />
                    <Text style={s.livePillText}>LIVE</Text>
                  </View>
                </View>
                <Text style={s.sectionSub}>
                  {ebay.active_count} active listings · {ebay.marketplace || "EBAY_US"}
                </Text>
                <View style={s.kpiGrid}>
                  <Kpi label="AVG" value={`$${ebay.avg_price.toFixed(2)}`} />
                  <Kpi label="MEDIAN" value={`$${ebay.median_price.toFixed(2)}`} />
                  <Kpi label="RANGE" value={`$${ebay.lowest_price.toFixed(0)}–$${ebay.highest_price.toFixed(0)}`} />
                </View>
              </View>
            ) : (
              <View style={[s.section, s.unavailableSection]}>
                <View style={s.rowBetween}>
                  <Text style={s.sectionTitle}>Live pricing</Text>
                  <Ionicons name="cloud-offline-outline" size={18} color={colors.warn} />
                </View>
                <Text style={s.unavailableText}>
                  {data.pricing_message || "Live pricing unavailable"}
                </Text>
              </View>
            )}

            {/* AI Insight — only when we have real data */}
            {ai ? (
              <View style={s.section}>
                <View style={s.rowBetween}>
                  <Text style={s.sectionTitle}>AI Insight</Text>
                  <Ionicons name="sparkles" size={16} color={colors.accent} />
                </View>
                <VerdictPill verdict={ai.verdict} />
                <View style={s.kpiGrid}>
                  <Kpi label="EXPECTED SALE" value={`$${ai.expected_sale_price.toFixed(2)}`} />
                  <Kpi label="EXPECTED PROFIT" value={`$${ai.expected_profit.toFixed(2)}`} />
                  <Kpi label="ROI" value={`${ai.roi_pct}%`} />
                </View>
                <View style={s.kpiGrid}>
                  <Kpi label="RISK LEVEL" value={ai.risk_level} />
                  <Kpi label="EBAY FEE (EST.)" value={`$${ai.ebay_fee_estimated.toFixed(2)}`} />
                  <Kpi label="SAMPLE" value={`${ai.sample_size}`} />
                </View>
                <Text style={s.subLabel}>SELL-THROUGH RECOMMENDATION</Text>
                <Text style={s.insightText}>{ai.sell_through_recommendation}</Text>
                <Text style={[s.subLabel, { marginTop: spacing.sm }]}>REASONING</Text>
                <Text style={s.insightText}>{ai.reasoning}</Text>
              </View>
            ) : (
              <View style={[s.section, s.unavailableSection]}>
                <View style={s.rowBetween}>
                  <Text style={s.sectionTitle}>AI Insight</Text>
                  <Ionicons name="sparkles" size={16} color={colors.textMuted} />
                </View>
                <Text style={s.unavailableText}>
                  AI insight requires live pricing. Configure eBay API to enable this feature.
                </Text>
              </View>
            )}

            {/* Marketplace buttons — always available */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>View on marketplaces</Text>
              <Text style={s.sectionSub}>Opens the real search page for this item</Text>
              <View style={s.mpGrid}>
                <MpBtn testID="mp-ebay" icon="pricetag" label="eBay" bg="#e53238" onPress={() => openLink(links?.ebay_active)} />
                <MpBtn testID="mp-amazon" icon="logo-amazon" label="Amazon" bg="#ff9900" onPress={() => openLink(links?.amazon)} />
                <MpBtn testID="mp-facebook" icon="logo-facebook" label="Facebook Marketplace" bg="#1877f2" onPress={() => openLink(links?.facebook)} />
                <MpBtn testID="mp-mercari" icon="cart" label="Mercari" bg="#5c6ac4" onPress={() => openLink(links?.mercari)} />
                <MpBtn testID="mp-whatnot" icon="videocam" label="Whatnot" bg="#ffde3a" fg="#0f172a" onPress={() => openLink(links?.whatnot)} />
              </View>
            </View>

            {/* Real active eBay listings */}
            {ebay && ebay.listings.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Active eBay listings</Text>
                <Text style={s.sectionSub}>Real live listings — tap to open in browser</Text>
                {ebay.listings.slice(0, 8).map((l, i) => (
                  <Pressable key={i} onPress={() => openLink(l.url)} style={s.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.listTitle} numberOfLines={2}>{l.title}</Text>
                      <Text style={s.listMeta}>
                        {l.condition || "—"}{l.seller ? ` · ${l.seller}` : ""}
                      </Text>
                    </View>
                    <View style={s.listPriceCol}>
                      <Text style={s.listPrice}>${l.price.toFixed(2)}</Text>
                      {l.shipping > 0 ? (
                        <Text style={s.listShip}>+ ${l.shipping.toFixed(2)} ship</Text>
                      ) : (
                        <Text style={s.listShipFree}>Free ship</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

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

function VerdictPill({ verdict }: { verdict: string }) {
  const map: Record<string, { bg: string; fg: string; icon: any }> = {
    "BUY": { bg: colors.goodBg, fg: colors.good, icon: "checkmark-circle" },
    "MAYBE BUY": { bg: colors.warnBg, fg: colors.warn, icon: "help-circle" },
    "AVOID": { bg: colors.badBg, fg: colors.bad, icon: "close-circle" },
  };
  const style = map[verdict?.toUpperCase()] || map["AVOID"];
  return (
    <View style={[s.verdictPill, { backgroundColor: style.bg }]}>
      <Ionicons name={style.icon} size={20} color={style.fg} />
      <Text style={[s.verdictText, { color: style.fg }]}>{verdict}</Text>
    </View>
  );
}

function MpBtn({
  testID, icon, label, bg, fg, onPress,
}: {
  testID: string; icon: any; label: string; bg: string; fg?: string; onPress: () => void;
}) {
  const textColor = fg || "#fff";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [{
        width: "48.5%",
        backgroundColor: bg,
        borderRadius: radius.md,
        height: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: pressed ? 0.85 : 1,
        paddingHorizontal: 8,
      }]}
    >
      <Ionicons name={icon} size={16} color={textColor} />
      <Text style={{ color: textColor, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
        {label}
      </Text>
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
  errText: { color: colors.bad, textAlign: "center", fontSize: 14 },
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
  unavailableSection: {
    borderColor: colors.warnBorder,
    backgroundColor: colors.warnBg,
  },
  unavailableText: { color: "#7c5e0a", fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  sectionSub: { fontSize: 11, color: colors.textMuted },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginTop: 4 },
  insightText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  kpiGrid: { flexDirection: "row", gap: spacing.sm },
  kpi: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.sm },
  kpiLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
  kpiValue: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 4 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goodBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goodBorder,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.good },
  livePillText: { fontSize: 9, fontWeight: "800", color: colors.good, letterSpacing: 1 },
  verdictPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  verdictText: { fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  mpGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  listRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
  },
  listTitle: { fontSize: 13, color: colors.text, fontWeight: "600" },
  listMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  listPriceCol: { alignItems: "flex-end" },
  listPrice: { fontSize: 15, fontWeight: "800", color: colors.text },
  listShip: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  listShipFree: { fontSize: 10, color: colors.good, marginTop: 2, fontWeight: "700" },
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
});
