import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { api, apiBaseUrl, getStoredToken } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type Item = {
  id: string;
  product_name: string;
  quantity: number;
  retail_value: number;
  estimated_resale_value: number;
  category: string;
  status: string;
  sold_price?: number | null;
};

type Pallet = {
  id: string;
  name: string;
  supplier?: string;
  total_investment: number;
  dashboard: {
    total_investment: number;
    revenue_recovered: number;
    current_profit: number;
    break_even_percent: number;
    break_even_remaining: number;
    remaining_inventory_value: number;
    estimated_final_profit: number;
    counts: Record<string, number>;
    total_items: number;
  };
};

type Analysis = {
  top_value_items: { name: string; value: number }[];
  fastest_moving: string[];
  high_risk: string[];
  slow_moving: string[];
  recommended_listing_order: string[];
  forecast: { conservative: number; expected: number; best_case: number };
};

const STATUSES = ["available", "listed", "sold", "damaged", "returned", "missing"];

export default function PalletDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pid = String(id);

  const [pallet, setPallet] = useState<Pallet | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "items" | "ai">("dashboard");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Item edit modal
  const [editing, setEditing] = useState<Item | null>(null);
  const [editSoldPrice, setEditSoldPrice] = useState("");
  const [editStatus, setEditStatus] = useState("available");

  const load = useCallback(async () => {
    try {
      const [p, its] = await Promise.all([
        api<Pallet>(`/pallets/${pid}`),
        api<Item[]>(`/pallets/${pid}/items`),
      ]);
      setPallet(p);
      setItems(its);
    } catch (e: any) {
      Alert.alert("Pallet", e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onUploadManifest = async () => {
    if (uploading) return;
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/pdf",
        "application/vnd.ms-excel",
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const file = res.assets[0];
    setUploading(true);
    try {
      const token = await getStoredToken();
      const form = new FormData();
      // RN FormData file shape
      form.append("file", {
        uri: file.uri,
        name: file.name || "manifest",
        type: file.mimeType || "application/octet-stream",
      } as any);
      const r = await fetch(`${apiBaseUrl}/api/pallets/${pid}/manifest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error(await r.text());
      const json = await r.json();
      Alert.alert("Manifest imported", `${json.imported} items added by AI`);
      await load();
    } catch (e: any) {
      Alert.alert("Upload failed", e.message || "");
    } finally {
      setUploading(false);
    }
  };

  const openAnalysis = async () => {
    setTab("ai");
    if (analysis) return;
    setAnalyzing(true);
    try {
      const r = await api<Analysis>(`/pallets/${pid}/analysis`);
      setAnalysis(r);
    } catch (e: any) {
      Alert.alert("AI", e.message || "");
    } finally {
      setAnalyzing(false);
    }
  };

  const openItemEditor = (it: Item) => {
    setEditing(it);
    setEditStatus(it.status);
    setEditSoldPrice(it.sold_price?.toString() || it.estimated_resale_value.toString());
  };

  const saveItemEdits = async () => {
    if (!editing) return;
    try {
      const body: any = { status: editStatus };
      if (editStatus === "sold") {
        body.sold_price = parseFloat(editSoldPrice) || 0;
      }
      await api(`/pallets/${pid}/items/${editing.id}`, { method: "PATCH", body });
      setEditing(null);
      // reset analysis so next AI fetch reflects new data
      setAnalysis(null);
      await load();
    } catch (e: any) {
      Alert.alert("Update failed", e.message || "");
    }
  };

  const deletePallet = () => {
    Alert.alert("Delete pallet?", "All items will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/pallets/${pid}`, { method: "DELETE" });
            router.back();
          } catch (e: any) {
            Alert.alert("Failed", e.message || "");
          }
        },
      },
    ]);
  };

  if (loading || !pallet) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const d = pallet.dashboard;
  const profitColor =
    d.current_profit > 0 ? colors.good : d.current_profit > -d.total_investment * 0.5 ? colors.warn : colors.bad;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Sticky header */}
      <View style={s.header}>
        <Pressable testID="pdetail-back" onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{pallet.name}</Text>
          <Text style={s.subtitle} numberOfLines={1}>{pallet.supplier || "—"}</Text>
        </View>
        <Pressable testID="pdetail-delete" onPress={deletePallet} style={s.iconBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.bad} />
        </Pressable>
      </View>
      <View style={s.tabsRow}>
        {(["dashboard", "items", "ai"] as const).map((t) => (
          <Pressable
            key={t}
            testID={`pdetail-tab-${t}`}
            onPress={() => (t === "ai" ? openAnalysis() : setTab(t))}
            style={[s.tab, tab === t && s.tabActive]}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "ai" ? "AI Analysis" : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "dashboard" ? (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.cashCard}>
            <Text style={s.cashLabel}>CURRENT PROFIT</Text>
            <Text style={[s.cashValue, { color: profitColor }]}>${d.current_profit.toFixed(2)}</Text>
            <View style={s.cashRow}>
              <View style={s.cashCell}>
                <Text style={s.cashCellLabel}>INVESTED</Text>
                <Text style={s.cashCellValue}>${d.total_investment.toFixed(2)}</Text>
              </View>
              <View style={s.cashCell}>
                <Text style={s.cashCellLabel}>RECOVERED</Text>
                <Text style={s.cashCellValue}>${d.revenue_recovered.toFixed(2)}</Text>
              </View>
              <View style={s.cashCell}>
                <Text style={s.cashCellLabel}>REMAINING</Text>
                <Text style={s.cashCellValue}>${d.remaining_inventory_value.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Break-even tracker</Text>
            <View style={s.progressWrap}>
              <View style={[s.progressBar, { width: `${Math.min(100, d.break_even_percent)}%` }]} />
            </View>
            <View style={s.beRow}>
              <Text style={s.beLabel}>{d.break_even_percent.toFixed(0)}% to break-even</Text>
              <Text style={s.beValue}>${d.break_even_remaining.toFixed(2)} to go</Text>
            </View>
            <View style={[s.kpiGrid, { marginTop: spacing.sm }]}>
              <Kpi label="EST FINAL PROFIT" value={`$${d.estimated_final_profit.toFixed(2)}`} />
              <Kpi label="TOTAL ITEMS" value={`${d.total_items}`} />
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Inventory status</Text>
            <View style={s.statusGrid}>
              {STATUSES.map((st) => (
                <View key={st} style={s.statusCell}>
                  <Text style={s.statusCount}>{d.counts[st] || 0}</Text>
                  <Text style={s.statusLabel}>{st.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={s.actionsRow}>
            <Pressable
              testID="pdetail-upload-manifest"
              onPress={onUploadManifest}
              disabled={uploading}
              style={s.actionBtn}
            >
              {uploading ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color={colors.primaryText} />
                  <Text style={s.actionText}>Import manifest</Text>
                </>
              )}
            </Pressable>
            <Pressable
              testID="pdetail-add-item"
              onPress={async () => {
                try {
                  await api(`/pallets/${pid}/items`, {
                    method: "POST",
                    body: { product_name: "New item", quantity: 1, estimated_resale_value: 0 },
                  });
                  await load();
                  setTab("items");
                } catch (e: any) {
                  Alert.alert("Failed", e.message || "");
                }
              }}
              style={[s.actionBtn, { backgroundColor: "#f1f5f9" }]}
            >
              <Ionicons name="add" size={18} color={colors.text} />
              <Text style={[s.actionText, { color: colors.text }]}>Add item</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {tab === "items" ? (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.scroll}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="list-outline" size={36} color={colors.textSubtle} />
              <Text style={s.emptyText}>No items yet. Upload a manifest to let AI extract them.</Text>
              <Pressable testID="items-empty-upload" onPress={onUploadManifest} style={s.actionBtn}>
                <Ionicons name="cloud-upload" size={18} color={colors.primaryText} />
                <Text style={s.actionText}>Import manifest</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const stColor =
              item.status === "sold"
                ? colors.good
                : item.status === "listed"
                ? colors.accent
                : item.status === "damaged" || item.status === "missing"
                ? colors.bad
                : colors.textMuted;
            return (
              <Pressable
                testID={`item-row-${item.id}`}
                onPress={() => openItemEditor(item)}
                style={s.itemRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={s.itemMeta}>
                    Qty {item.quantity} · Resale ${item.estimated_resale_value.toFixed(2)}
                    {item.sold_price != null && item.status === "sold" ? `  ·  Sold $${item.sold_price.toFixed(2)}` : ""}
                  </Text>
                </View>
                <View style={[s.statusPill, { borderColor: stColor }]}>
                  <Text style={[s.statusPillText, { color: stColor }]}>{item.status.toUpperCase()}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : null}

      {tab === "ai" ? (
        <ScrollView contentContainerStyle={s.scroll}>
          {analyzing ? (
            <View style={s.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.loadingText}>AI is analyzing your pallet…</Text>
            </View>
          ) : analysis ? (
            <>
              <View style={s.section}>
                <Text style={s.sectionTitle}>Profit forecast</Text>
                <View style={s.kpiGrid}>
                  <Kpi label="CONSERVATIVE" value={`$${analysis.forecast.conservative.toFixed(0)}`} />
                  <Kpi label="EXPECTED" value={`$${analysis.forecast.expected.toFixed(0)}`} />
                  <Kpi label="BEST CASE" value={`$${analysis.forecast.best_case.toFixed(0)}`} />
                </View>
              </View>
              <ListSection title="Top 10 most valuable" items={analysis.top_value_items.map((x) => `${x.name} ($${x.value.toFixed(2)})`)} icon="trophy" />
              <ListSection title="Fastest moving (AI)" items={analysis.fastest_moving} icon="flash" />
              <ListSection title="High-risk items (AI)" items={analysis.high_risk} icon="warning" />
              <ListSection title="Slow-moving (AI)" items={analysis.slow_moving} icon="hourglass" />
              <ListSection title="Recommended listing order (AI)" items={analysis.recommended_listing_order} icon="list" />
            </>
          ) : (
            <Text style={s.muted}>No analysis yet.</Text>
          )}
        </ScrollView>
      ) : null}

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setEditing(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle} numberOfLines={1}>{editing?.product_name}</Text>
            <Text style={s.label}>STATUS</Text>
            <View style={s.statusOptions}>
              {STATUSES.map((st) => (
                <Pressable
                  key={st}
                  testID={`edit-status-${st}`}
                  onPress={() => setEditStatus(st)}
                  style={[s.statusOpt, editStatus === st && s.statusOptActive]}
                >
                  <Text style={[s.statusOptText, editStatus === st && s.statusOptTextActive]}>
                    {st}
                  </Text>
                </Pressable>
              ))}
            </View>
            {editStatus === "sold" ? (
              <>
                <Text style={s.label}>SOLD PRICE $</Text>
                <TextInput
                  testID="edit-sold-price"
                  style={s.modalInput}
                  keyboardType="decimal-pad"
                  value={editSoldPrice}
                  onChangeText={setEditSoldPrice}
                />
              </>
            ) : null}
            <Pressable
              testID="edit-save"
              onPress={saveItemEdits}
              style={[s.actionBtn, { marginTop: spacing.md }]}
            >
              <Text style={s.actionText}>Save</Text>
            </Pressable>
            <Pressable
              testID="edit-delete-item"
              onPress={async () => {
                if (!editing) return;
                try {
                  await api(`/pallets/${pid}/items/${editing.id}`, { method: "DELETE" });
                  setEditing(null);
                  setAnalysis(null);
                  await load();
                } catch (e: any) {
                  Alert.alert("Failed", e.message || "");
                }
              }}
              style={s.deleteLink}
            >
              <Text style={s.deleteLinkText}>Delete item</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

function ListSection({ title, items, icon }: { title: string; items: string[]; icon: any }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <Ionicons name={icon} size={16} color={colors.accent} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {items.slice(0, 10).map((it, i) => (
        <View key={i} style={s.listRow}>
          <Text style={s.listIndex}>{i + 1}.</Text>
          <Text style={s.listText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "#f1f5f9" },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  tabTextActive: { color: colors.primaryText },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  cashCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cashLabel: { color: "#cbd5e1", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  cashValue: { fontSize: 36, fontWeight: "900", marginTop: 4 },
  cashRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cashCell: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", padding: spacing.sm, borderRadius: radius.md },
  cashCellLabel: { color: "#94a3b8", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  cashCellValue: { color: colors.primaryText, fontWeight: "800", fontSize: 14, marginTop: 4 },
  section: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  progressWrap: { height: 10, backgroundColor: "#f1f5f9", borderRadius: radius.pill, overflow: "hidden" },
  progressBar: { height: "100%", backgroundColor: colors.good },
  beRow: { flexDirection: "row", justifyContent: "space-between" },
  beLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  beValue: { fontSize: 12, color: colors.text, fontWeight: "800" },
  kpiGrid: { flexDirection: "row", gap: spacing.sm },
  kpi: { flex: 1, backgroundColor: "#f1f5f9", borderRadius: radius.md, padding: spacing.sm },
  kpiLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
  kpiValue: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 4 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statusCell: { width: "31.2%", backgroundColor: "#f8fafc", borderRadius: radius.md, padding: spacing.sm, alignItems: "center" },
  statusCount: { fontSize: 20, fontWeight: "900", color: colors.text },
  statusLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  actionText: { color: colors.primaryText, fontWeight: "700" },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemName: { fontSize: 14, fontWeight: "700", color: colors.text },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  statusPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  loading: { alignItems: "center", padding: spacing.xl, gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 13 },
  listRow: { flexDirection: "row", paddingVertical: 6, gap: spacing.sm },
  listIndex: { color: colors.textMuted, fontSize: 12, fontWeight: "700", width: 22 },
  listText: { color: colors.text, fontSize: 13, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  label: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginTop: spacing.sm },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 15, color: colors.text },
  statusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  statusOpt: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: colors.border },
  statusOptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusOptText: { color: colors.text, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  statusOptTextActive: { color: colors.primaryText },
  deleteLink: { alignItems: "center", marginTop: spacing.sm, padding: spacing.sm },
  deleteLinkText: { color: colors.bad, fontWeight: "700" },
});
