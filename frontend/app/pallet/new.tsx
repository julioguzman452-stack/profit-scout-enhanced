import { useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

export default function NewPallet() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchasePrice, setPurchasePrice] = useState("");
  const [shipping, setShipping] = useState("0");
  const [tax, setTax] = useState("0");
  const [extra, setExtra] = useState("0");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const totalInvest = (
    (parseFloat(purchasePrice) || 0) +
    (parseFloat(shipping) || 0) +
    (parseFloat(tax) || 0) +
    (parseFloat(extra) || 0)
  ).toFixed(2);

  const onCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Name required");
      return;
    }
    setLoading(true);
    try {
      const p = await api<{ id: string }>("/pallets", {
        method: "POST",
        body: {
          name: name.trim(),
          supplier: supplier.trim(),
          purchase_date: purchaseDate,
          purchase_price: parseFloat(purchasePrice) || 0,
          shipping_cost: parseFloat(shipping) || 0,
          tax_cost: parseFloat(tax) || 0,
          additional_costs: parseFloat(extra) || 0,
          notes,
        },
      });
      router.replace({ pathname: "/pallet/[id]", params: { id: p.id } });
    } catch (e: any) {
      Alert.alert("Failed", e.message || "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <Pressable testID="newp-close" onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={s.title}>New pallet</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Field testID="newp-name" label="PALLET NAME" value={name} onChangeText={setName} placeholder="e.g. Amazon LPN 12/22" />
          <Field testID="newp-supplier" label="SUPPLIER" value={supplier} onChangeText={setSupplier} placeholder="e.g. Direct Liquidation" />
          <Field testID="newp-date" label="PURCHASE DATE" value={purchaseDate} onChangeText={setPurchaseDate} placeholder="YYYY-MM-DD" />
          <Row>
            <Field testID="newp-price" label="PURCHASE $" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" />
            <Field testID="newp-shipping" label="SHIPPING $" value={shipping} onChangeText={setShipping} keyboardType="decimal-pad" />
          </Row>
          <Row>
            <Field testID="newp-tax" label="TAX $" value={tax} onChangeText={setTax} keyboardType="decimal-pad" />
            <Field testID="newp-extra" label="EXTRA $" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" />
          </Row>
          <Field testID="newp-notes" label="NOTES" value={notes} onChangeText={setNotes} multiline placeholder="Anything to remember" />

          <View style={s.totalBox}>
            <Text style={s.totalLabel}>TOTAL INVESTMENT</Text>
            <Text style={s.totalValue} testID="newp-total-invest">${totalInvest}</Text>
          </View>

          <Pressable
            testID="newp-create-button"
            onPress={onCreate}
            disabled={loading}
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
          >
            {loading ? <ActivityIndicator color={colors.primaryText} /> : <Text style={s.btnText}>Create pallet</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ children }: any) {
  return <View style={{ flexDirection: "row", gap: spacing.sm }}>{children}</View>;
}

function Field({ label, ...rest }: any) {
  return (
    <View style={{ marginTop: spacing.sm, flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={colors.textSubtle} {...rest} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  body: { padding: spacing.lg, paddingTop: 0, gap: 0, paddingBottom: spacing.xxl },
  label: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  totalBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  totalLabel: { color: "#cbd5e1", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  totalValue: { color: colors.primaryText, fontSize: 28, fontWeight: "900", marginTop: 4 },
  btn: {
    marginTop: spacing.lg,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: colors.primaryText, fontWeight: "700", fontSize: 16 },
});
