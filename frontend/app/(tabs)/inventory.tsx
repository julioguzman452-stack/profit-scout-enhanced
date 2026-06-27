import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { radius, spacing } from "@/src/theme";

type InvItem = {
  id: string;
  title: string;
  source: string;
  platform?: string | null;
  status: string;
  purchase_price: number;
  sale_price?: number | null;
  metrics: { net_profit: number; roi_pct: number };
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "in_stock", label: "In stock" },
  { id: "listed", label: "Listed" },
  { id: "sold", label: "Sold" },
  { id: "returned", label: "Returned" },
];

export default function InventoryTab() {
  const router = useRouter();
  const { colors, symbol } = usePrefs();
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = filter === "all" ? "/inventory" : `/inventory?status=${filter}`;
      const r = await api<InvItem[]>(url);
      setItems(r);
    } catch (e: any) {
      Alert.alert("Inventory", e.message || "");
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const s = makeStyles(colors);

  const statusColor = (st: string) =>
    st === "sold" ? colors.good : st === "listed" ? colors.accent : st === "returned" ? colors.bad : colors.textMuted;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Inventory</Text>
          <Text style={s.sub}>{items.length} item{items.length === 1 ? "" : "s"}</Text>
        </View>
        <Pressable
          testID="inventory-new"
          onPress={() => router.push("/inventory/new")}
          style={({ pressed }) => [s.newBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add" size={20} color={colors.primaryText} />
          <Text style={s.newBtnText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            testID={`inv-filter-${f.id}`}
            onPress={() => setFilter(f.id)}
            style={[
              s.filterChip,
              filter === f.id && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Text style={[s.filterChipText, filter === f.id && { color: colors.primaryText }]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={s.list}
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
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={s.empty}>
              <Ionicons name="layers-outline" size={40} color={colors.textSubtle} />
              <Text style={s.emptyTitle}>No inventory yet</Text>
              <Text style={s.emptyText}>Add items manually, or scan and tap "Add to Inventory" on the product screen.</Text>
              <Pressable testID="inv-empty-add" onPress={() => router.push("/inventory/new")} style={s.emptyBtn}>
                <Text style={s.emptyBtnText}>Add first item</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => {
          const profit = item.metrics.net_profit;
          const pColor = item.status === "sold" ? (profit > 0 ? colors.good : profit < 0 ? colors.bad : colors.textMuted) : colors.textMuted;
          return (
            <Pressable
              testID={`inv-row-${item.id}`}
              onPress={() => router.push({ pathname: "/inventory/[id]", params: { id: item.id } })}
              style={s.row}
            >
              <View style={[s.statusDot, { backgroundColor: statusColor(item.status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  {item.source}{item.platform ? ` · ${item.platform}` : ""} · {item.status.replace("_", " ")}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.rowProfit, { color: pColor }]}>
                  {item.status === "sold" ? `${symbol}${profit.toFixed(2)}` : `${symbol}${item.purchase_price.toFixed(2)}`}
                </Text>
                <Text style={s.rowMeta}>
                  {item.status === "sold" ? `${item.metrics.roi_pct}% ROI` : "cost"}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      padding: spacing.lg,
      paddingBottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    newBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: spacing.md,
      height: 40,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    newBtnText: { color: c.primaryText, fontWeight: "700", fontSize: 14 },
    filterScroll: { maxHeight: 50, marginBottom: spacing.sm },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
      flexShrink: 0,
    },
    filterChipText: { fontSize: 12, fontWeight: "700", color: c.text },
    list: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl, gap: spacing.sm },
    empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: "800", marginTop: spacing.sm },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: "center" },
    emptyBtn: { marginTop: spacing.md, backgroundColor: c.primary, paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    emptyBtnText: { color: c.primaryText, fontWeight: "700" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    rowTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    rowMeta: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    rowProfit: { fontSize: 14, fontWeight: "800" },
  });
