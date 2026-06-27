import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type Pallet = {
  id: string;
  name: string;
  supplier?: string;
  purchase_date?: string;
  total_investment: number;
  created_at: string;
  dashboard?: {
    revenue_recovered: number;
    current_profit: number;
    break_even_percent: number;
    total_items: number;
  };
};

export default function PalletsTab() {
  const router = useRouter();
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Pallet[]>("/pallets");
      setPallets(r);
    } catch (e: any) {
      Alert.alert("Pallets", e.message || "Failed to load");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const profitColor = (profit: number, total: number) => {
    if (total === 0) return colors.textMuted;
    if (profit > 0) return colors.good;
    if (profit > -total * 0.5) return colors.warn;
    return colors.bad;
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Pallet Mode</Text>
          <Text style={s.sub}>Track liquidation pallet profit recovery</Text>
        </View>
        <Pressable
          testID="pallets-new-button"
          onPress={() => router.push("/pallet/new")}
          style={({ pressed }) => [s.newBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add" size={20} color={colors.primaryText} />
          <Text style={s.newBtnText}>New</Text>
        </Pressable>
      </View>

      <FlatList
        data={pallets}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={s.scroll}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={40} color={colors.textSubtle} />
              <Text style={s.emptyText}>No pallets yet</Text>
              <Text style={s.emptySub}>Create one to track investment vs revenue, break-even and AI forecast.</Text>
              <Pressable
                testID="pallets-empty-create"
                onPress={() => router.push("/pallet/new")}
                style={s.emptyBtn}
              >
                <Text style={s.emptyBtnText}>Create your first pallet</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => {
          const d = item.dashboard || { revenue_recovered: 0, current_profit: 0, break_even_percent: 0, total_items: 0 };
          const pc = profitColor(d.current_profit, item.total_investment);
          return (
            <Pressable
              testID={`pallet-card-${item.id}`}
              onPress={() => router.push({ pathname: "/pallet/[id]", params: { id: item.id } })}
              style={s.card}
            >
              <View style={s.cardHead}>
                <Text style={s.palletName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.palletSupplier} numberOfLines={1}>{item.supplier || "—"}</Text>
              </View>
              <View style={s.cardKpis}>
                <Kpi label="INVESTED" value={`$${item.total_investment.toFixed(2)}`} />
                <Kpi label="REVENUE" value={`$${d.revenue_recovered.toFixed(2)}`} />
                <Kpi label="PROFIT" value={`$${d.current_profit.toFixed(2)}`} color={pc} />
              </View>
              <View style={s.progressWrap}>
                <View style={[s.progressBar, { width: `${Math.min(100, d.break_even_percent)}%` }]} />
              </View>
              <Text style={s.progressLabel}>
                Break-even {d.break_even_percent.toFixed(0)}% · {d.total_items} items
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  newBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newBtnText: { color: colors.primaryText, fontWeight: "700", fontSize: 14 },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: spacing.sm },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: { color: colors.primaryText, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHead: { marginBottom: spacing.sm },
  palletName: { fontSize: 16, fontWeight: "800", color: colors.text },
  palletSupplier: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardKpis: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  kpi: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  kpiLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
  kpiValue: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 4 },
  progressWrap: {
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressBar: { height: "100%", backgroundColor: colors.good },
  progressLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
