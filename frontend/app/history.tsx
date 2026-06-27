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
import { colors, radius, spacing, verdictColor } from "@/src/theme";

type Row = {
  id: string;
  title: string;
  created_at: string;
  source: string;
  notes?: string;
  tags?: string[];
  profit?: { verdict?: string; net_profit?: number; roi_pct?: number };
};

export default function History() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Row[]>("/history");
      setRows(r);
    } catch (e: any) {
      Alert.alert("History", e.message || "Failed to load");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onDelete = (id: string) => {
    Alert.alert("Delete scan?", "This will remove this entry from history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/history/${id}`, { method: "DELETE" });
            setRows((r) => r.filter((x) => x.id !== id));
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>History</Text>
        <Text style={s.sub}>Past scans, searches, profit checks</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(it) => it.id}
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
              <Ionicons name="archive-outline" size={36} color={colors.textSubtle} />
              <Text style={s.emptyText}>No scans yet. Try a search or barcode.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const v = item.profit?.verdict;
          const c = verdictColor(v || "MAYBE");
          return (
            <Pressable
              testID={`history-row-${item.id}`}
              onPress={() => router.push({ pathname: "/product", params: { q: item.title } })}
              onLongPress={() => onDelete(item.id)}
              style={s.row}
            >
              <View style={s.rowIcon}>
                <Ionicons
                  name={item.source === "barcode" ? "barcode" : item.source === "camera" ? "camera" : "search"}
                  size={18}
                  color={colors.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.rowMeta}>
                  {new Date(item.created_at).toLocaleDateString()}
                  {item.profit?.net_profit !== undefined
                    ? `  •  $${item.profit.net_profit?.toFixed?.(2) ?? item.profit.net_profit} (${item.profit.roi_pct}%)`
                    : ""}
                </Text>
                {item.tags && item.tags.length > 0 ? (
                  <View style={s.tagRow}>
                    {item.tags.slice(0, 3).map((t) => (
                      <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
                    ))}
                  </View>
                ) : null}
              </View>
              {v ? (
                <View style={[s.pill, { backgroundColor: c.bg }]}>
                  <Text style={[s.pillText, { color: c.fg }]}>{v}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  rowMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tagRow: { flexDirection: "row", gap: 4, marginTop: 6 },
  tag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { fontSize: 10, color: colors.text, fontWeight: "600" },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
});
