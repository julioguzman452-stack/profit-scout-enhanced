// Shared form for creating/editing an inventory item.
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { usePrefs } from "@/src/context/PrefsContext";
import { radius, spacing } from "@/src/theme";

const SOURCES = ["Whatnot", "Pallet", "Facebook", "Garage Sale", "Flea Market", "Auction", "Thrift Store", "Retail Arbitrage", "Other"];
const PLATFORMS = ["eBay", "Whatnot", "Facebook Marketplace", "Mercari", "Local Sale"];
const STATUSES = ["in_stock", "listed", "sold", "returned"];

type Mode = "new" | "edit";

export default function InventoryForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { id, prefill } = useLocalSearchParams<{ id?: string; prefill?: string }>();
  const { colors, symbol } = usePrefs();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("Other");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [fees, setFees] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [tax, setTax] = useState("0");
  const [packaging, setPackaging] = useState("0");
  const [misc, setMisc] = useState("0");
  const [platform, setPlatform] = useState<string | null>(null);
  const [status, setStatus] = useState("in_stock");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(mode === "edit");

  useEffect(() => {
    if (mode === "new" && prefill) {
      setTitle(String(prefill));
    }
  }, [mode, prefill]);

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    (async () => {
      try {
        const it = await api<any>(`/inventory/${id}`);
        setTitle(it.title || "");
        setCategory(it.category || "");
        setSource(it.source || "Other");
        setPurchasePrice(String(it.purchase_price || ""));
        setSalePrice(it.sale_price != null ? String(it.sale_price) : "");
        setFees(String(it.fees || 0));
        setShipping(String(it.shipping || 0));
        setTax(String(it.tax || 0));
        setPackaging(String(it.packaging || 0));
        setMisc(String(it.misc || 0));
        setPlatform(it.platform || null);
        setStatus(it.status || "in_stock");
        setNotes(it.notes || "");
      } catch (e: any) {
        Alert.alert("Load failed", e.message || "");
      } finally {
        setHydrating(false);
      }
    })();
  }, [mode, id]);

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required");
      return;
    }
    setLoading(true);
    const body: any = {
      title: title.trim(),
      category: category.trim(),
      source,
      purchase_price: parseFloat(purchasePrice) || 0,
      sale_price: salePrice ? parseFloat(salePrice) || 0 : null,
      fees: parseFloat(fees) || 0,
      shipping: parseFloat(shipping) || 0,
      tax: parseFloat(tax) || 0,
      packaging: parseFloat(packaging) || 0,
      misc: parseFloat(misc) || 0,
      platform,
      status,
      notes,
    };
    try {
      if (mode === "new") {
        await api("/inventory", { method: "POST", body });
      } else {
        await api(`/inventory/${id}`, { method: "PATCH", body });
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Save failed", e.message || "");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = () => {
    if (mode !== "edit") return;
    Alert.alert("Delete item?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/inventory/${id}`, { method: "DELETE" });
            router.back();
          } catch (e: any) {
            Alert.alert("Failed", e.message || "");
          }
        },
      },
    ]);
  };

  const s = makeStyles(colors);

  if (hydrating) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Live profit math preview
  const bc = parseFloat(purchasePrice) || 0;
  const sp = parseFloat(salePrice) || 0;
  const totalCost = bc + (parseFloat(fees) || 0) + (parseFloat(shipping) || 0) + (parseFloat(tax) || 0) + (parseFloat(packaging) || 0) + (parseFloat(misc) || 0);
  const net = sp - totalCost;
  const roi = bc > 0 && sp > 0 ? (net / bc) * 100 : 0;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <Pressable testID="invform-close" onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={s.headerTitle}>{mode === "new" ? "Add item" : "Edit item"}</Text>
          {mode === "edit" ? (
            <Pressable testID="invform-delete" onPress={onDelete}>
              <Ionicons name="trash-outline" size={22} color={colors.bad} />
            </Pressable>
          ) : <View style={{ width: 26 }} />}
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Field label="TITLE" testID="invform-title" value={title} onChangeText={setTitle} colors={colors} placeholder="e.g. Sony WH-1000XM4" />
          <Field label="CATEGORY" testID="invform-category" value={category} onChangeText={setCategory} colors={colors} placeholder="e.g. Audio" />

          <Text style={s.label}>SOURCING</Text>
          <ChipRow values={SOURCES} active={source} onChange={setSource} colors={colors} testIDPrefix="src" />

          <Text style={[s.label, { marginTop: spacing.md }]}>STATUS</Text>
          <ChipRow values={STATUSES} active={status} onChange={setStatus} colors={colors} testIDPrefix="status" pretty />

          <Text style={[s.label, { marginTop: spacing.md }]}>PLATFORM</Text>
          <ChipRow
            values={["—", ...PLATFORMS]}
            active={platform || "—"}
            onChange={(v) => setPlatform(v === "—" ? null : v)}
            colors={colors}
            testIDPrefix="platform"
          />

          <View style={s.row}>
            <Field label={`PURCHASE ${symbol}`} testID="invform-purchase" value={purchasePrice} onChangeText={setPurchasePrice} colors={colors} keyboardType="decimal-pad" />
            <Field label={`SALE ${symbol}`} testID="invform-sale" value={salePrice} onChangeText={setSalePrice} colors={colors} keyboardType="decimal-pad" />
          </View>
          <View style={s.row}>
            <Field label={`FEES ${symbol}`} testID="invform-fees" value={fees} onChangeText={setFees} colors={colors} keyboardType="decimal-pad" />
            <Field label={`SHIP ${symbol}`} testID="invform-shipping" value={shipping} onChangeText={setShipping} colors={colors} keyboardType="decimal-pad" />
          </View>
          <View style={s.row}>
            <Field label={`TAX ${symbol}`} testID="invform-tax" value={tax} onChangeText={setTax} colors={colors} keyboardType="decimal-pad" />
            <Field label={`PACK ${symbol}`} testID="invform-pack" value={packaging} onChangeText={setPackaging} colors={colors} keyboardType="decimal-pad" />
            <Field label={`MISC ${symbol}`} testID="invform-misc" value={misc} onChangeText={setMisc} colors={colors} keyboardType="decimal-pad" />
          </View>

          <Field label="NOTES" testID="invform-notes" value={notes} onChangeText={setNotes} colors={colors} multiline />

          <View style={s.preview}>
            <View>
              <Text style={s.previewLabel}>NET PROFIT</Text>
              <Text style={[s.previewValue, { color: net >= 0 ? colors.good : colors.bad }]}>
                {symbol}{net.toFixed(2)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.previewLabel}>ROI</Text>
              <Text style={[s.previewValue, { color: roi >= 0 ? colors.good : colors.bad }]}>{roi.toFixed(1)}%</Text>
            </View>
          </View>

          <Pressable
            testID="invform-save"
            onPress={onSave}
            disabled={loading}
            style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.85 }]}
          >
            {loading ? <ActivityIndicator color={colors.primaryText} /> : <Text style={s.saveBtnText}>{mode === "new" ? "Add to inventory" : "Save changes"}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, colors, ...rest }: any) {
  return (
    <View style={{ flex: 1, marginTop: spacing.sm }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.inputBg,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          fontSize: 15,
          color: colors.text,
        }}
        placeholderTextColor={colors.textSubtle}
        {...rest}
      />
    </View>
  );
}

function ChipRow({ values, active, onChange, colors, testIDPrefix, pretty }: any) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
    >
      {values.map((v: string) => {
        const isActive = active === v;
        const display = pretty ? v.replace("_", " ") : v;
        return (
          <Pressable
            key={v}
            testID={`${testIDPrefix}-${v}`}
            onPress={() => onChange(v)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.pill,
              backgroundColor: isActive ? colors.primary : colors.cardAlt,
              borderWidth: 1,
              borderColor: isActive ? colors.primary : colors.border,
              flexShrink: 0,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: isActive ? colors.primaryText : colors.text, textTransform: pretty ? "capitalize" : "none" }}>
              {display}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: { fontSize: 18, fontWeight: "800", color: c.text },
    body: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
    label: { fontSize: 10, fontWeight: "700", color: c.textMuted, letterSpacing: 1, marginTop: spacing.md, marginBottom: 4 },
    row: { flexDirection: "row", gap: spacing.sm },
    preview: {
      marginTop: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: c.cardAlt,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    previewLabel: { fontSize: 10, color: c.textMuted, fontWeight: "700", letterSpacing: 1 },
    previewValue: { fontSize: 22, fontWeight: "900", marginTop: 4 },
    saveBtn: {
      marginTop: spacing.lg,
      height: 52,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnText: { color: c.primaryText, fontWeight: "700", fontSize: 16 },
  });
