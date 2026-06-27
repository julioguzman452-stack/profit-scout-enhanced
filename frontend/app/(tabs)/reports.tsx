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
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { usePrefs } from "@/src/context/PrefsContext";
import { radius, spacing } from "@/src/theme";

const PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

type ReportRow = { label: string; revenue: number; profit: number; count: number };
type Report = { rows: ReportRow[]; totals: { revenue: number; profit: number; count: number } };
type SourcingRow = {
  source: string;
  revenue: number;
  profit: number;
  roi_pct: number;
  items: number;
  sold: number;
  avg_days_to_sell: number | null;
};

export default function Reports() {
  const { colors, symbol } = usePrefs();
  const [period, setPeriod] = useState("monthly");
  const [report, setReport] = useState<Report | null>(null);
  const [sourcing, setSourcing] = useState<{ rows: SourcingRow[]; best_source: string; worst_source: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rep, src] = await Promise.all([
        api<Report>(`/stats/reports?period=${period}`),
        api<{ rows: SourcingRow[]; best_source: string; worst_source: string }>(`/stats/sourcing`),
      ]);
      setReport(rep);
      setSourcing(src);
    } catch {}
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const s = makeStyles(colors);
  const maxProfit = report ? Math.max(1, ...report.rows.map((r) => Math.abs(r.profit))) : 1;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Reports</Text>
        <Text style={s.sub}>Profit & sourcing analytics</Text>
      </View>

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
          style={{ maxHeight: 50 }}
        >
          {PERIODS.map((p) => (
            <Pressable
              key={p.id}
              testID={`report-period-${p.id}`}
              onPress={() => setPeriod(p.id)}
              style={[
                s.periodChip,
                period === p.id && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text style={[s.periodChipText, period === p.id && { color: colors.primaryText }]}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && !report ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {report ? (
              <View style={s.section}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Cell label="REVENUE" value={`${symbol}${report.totals.revenue.toFixed(2)}`} colors={colors} />
                  <Cell label="PROFIT" value={`${symbol}${report.totals.profit.toFixed(2)}`} colors={colors} accent={report.totals.profit >= 0 ? colors.good : colors.bad} />
                  <Cell label="SOLD" value={`${report.totals.count}`} colors={colors} />
                </View>

                <Text style={s.subTitle}>By {period}</Text>
                {report.rows.length === 0 ? (
                  <Text style={s.muted}>No sold items yet for this period.</Text>
                ) : (
                  report.rows.map((r, i) => {
                    const w = Math.min(100, (Math.abs(r.profit) / maxProfit) * 100);
                    const barColor = r.profit >= 0 ? colors.good : colors.bad;
                    return (
                      <View key={i} style={s.barRow}>
                        <Text style={s.barLabel}>{r.label}</Text>
                        <View style={s.barTrack}>
                          <View style={[s.barFill, { width: `${w}%`, backgroundColor: barColor }]} />
                        </View>
                        <Text style={[s.barValue, { color: barColor }]}>{symbol}{r.profit.toFixed(0)}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {sourcing && sourcing.rows.length > 0 ? (
              <View style={s.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={s.sectionTitle}>Sourcing analytics</Text>
                  <Ionicons name="trending-up" size={16} color={colors.accent} />
                </View>
                <View style={s.bestRow}>
                  <View style={[s.bestPill, { backgroundColor: colors.goodBg, borderColor: colors.goodBorder }]}>
                    <Text style={[s.bestPillLabel, { color: colors.good }]}>BEST</Text>
                    <Text style={[s.bestPillName, { color: colors.good }]}>{sourcing.best_source}</Text>
                  </View>
                  <View style={[s.bestPill, { backgroundColor: colors.badBg, borderColor: colors.badBorder }]}>
                    <Text style={[s.bestPillLabel, { color: colors.bad }]}>WORST</Text>
                    <Text style={[s.bestPillName, { color: colors.bad }]}>{sourcing.worst_source}</Text>
                  </View>
                </View>
                {sourcing.rows.map((r) => (
                  <View key={r.source} style={s.srcRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.srcName}>{r.source}</Text>
                      <Text style={s.srcMeta}>
                        {r.sold}/{r.items} sold{r.avg_days_to_sell != null ? ` · ${r.avg_days_to_sell}d avg` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.srcProfit, { color: r.profit >= 0 ? colors.good : colors.bad }]}>
                        {symbol}{r.profit.toFixed(2)}
                      </Text>
                      <Text style={s.srcMeta}>{r.roi_pct}% ROI</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({ label, value, colors, accent }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.sm }}>
      <Text style={{ fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "800", color: accent || colors.text, marginTop: 4 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { padding: spacing.lg, paddingBottom: spacing.sm },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl, gap: spacing.md },
    periodChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
      flexShrink: 0,
    },
    periodChipText: { fontSize: 12, fontWeight: "700", color: c.text },
    section: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    subTitle: { fontSize: 11, fontWeight: "700", color: c.textMuted, letterSpacing: 1, marginTop: spacing.sm },
    muted: { fontSize: 12, color: c.textMuted },
    barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
    barLabel: { width: 78, fontSize: 11, color: c.textMuted, fontWeight: "600" },
    barTrack: { flex: 1, height: 10, backgroundColor: c.cardAlt, borderRadius: radius.pill, overflow: "hidden" },
    barFill: { height: "100%" },
    barValue: { width: 64, textAlign: "right", fontWeight: "800", fontSize: 12 },
    bestRow: { flexDirection: "row", gap: spacing.sm },
    bestPill: { flex: 1, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1 },
    bestPillLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
    bestPillName: { fontSize: 14, fontWeight: "800", marginTop: 2 },
    srcRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    srcName: { fontSize: 13, fontWeight: "700", color: c.text },
    srcMeta: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    srcProfit: { fontSize: 14, fontWeight: "800" },
  });
