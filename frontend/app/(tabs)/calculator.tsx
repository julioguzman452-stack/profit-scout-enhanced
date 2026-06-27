import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing, verdictColor } from "@/src/theme";

export default function Calculator() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [itemName, setItemName] = useState(params.q ? String(params.q) : "");
  const [buyCost, setBuyCost] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [shipping, setShipping] = useState("0");
  const [feePct, setFeePct] = useState("13.25");
  const [tax, setTax] = useState("0");
  const [extra, setExtra] = useState("0");

  const [result, setResult] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localCalc = useMemo(() => {
    const bc = parseFloat(buyCost) || 0;
    const sp = parseFloat(sellPrice) || 0;
    const sh = parseFloat(shipping) || 0;
    const fp = parseFloat(feePct) || 0;
    const tx = parseFloat(tax) || 0;
    const ex = parseFloat(extra) || 0;
    const fees = sp * (fp / 100);
    const total = bc + sh + tx + ex + fees;
    const net = sp - total;
    const roi = bc > 0 ? (net / bc) * 100 : 0;
    return { fees, net, roi };
  }, [buyCost, sellPrice, shipping, feePct, tax, extra]);

  const onCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api("/profit/verdict", {
        method: "POST",
        body: {
          item_name: itemName || "Item",
          buy_cost: parseFloat(buyCost) || 0,
          sell_price: parseFloat(sellPrice) || 0,
          shipping_cost: parseFloat(shipping) || 0,
          ebay_fee_pct: parseFloat(feePct) || 0,
          tax_cost: parseFloat(tax) || 0,
          extra_cost: parseFloat(extra) || 0,
        },
      });
      setResult(r);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [itemName, buyCost, sellPrice, shipping, feePct, tax, extra]);

  const onScore = useCallback(async () => {
    if (!itemName.trim()) return;
    setScoring(true);
    try {
      const r = await api("/score", {
        method: "POST",
        body: {
          query: itemName,
          buy_cost: parseFloat(buyCost) || 0,
          sell_price: parseFloat(sellPrice) || 0,
          ebay_fee_pct: parseFloat(feePct) || 0,
          shipping_cost: parseFloat(shipping) || 0,
          extra_cost: parseFloat(extra) || 0,
        },
      });
      setScore(r);
    } catch (e: any) {
      setError(e.message || "Score failed");
    } finally {
      setScoring(false);
    }
  }, [itemName, buyCost, sellPrice, feePct, shipping, extra]);

  const vc = result ? verdictColor(result.verdict) : verdictColor("MAYBE");
  const scoreColor =
    score && score.score >= 70 ? colors.good : score && score.score >= 45 ? colors.warn : colors.bad;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Profit Calculator</Text>
        <Text style={s.sub}>eBay fees + shipping + tax → verdict</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Field label="ITEM NAME (optional)" value={itemName} onChangeText={setItemName} testID="calc-item-name" placeholder="e.g. Nintendo Switch OLED" />
          <Row>
            <Field label="BUY COST $" value={buyCost} onChangeText={setBuyCost} keyboardType="decimal-pad" testID="calc-buy-cost" />
            <Field label="SELL PRICE $" value={sellPrice} onChangeText={setSellPrice} keyboardType="decimal-pad" testID="calc-sell-price" />
          </Row>
          <Row>
            <Field label="SHIPPING $" value={shipping} onChangeText={setShipping} keyboardType="decimal-pad" testID="calc-shipping" />
            <Field label="EBAY FEE %" value={feePct} onChangeText={setFeePct} keyboardType="decimal-pad" testID="calc-fee" />
          </Row>
          <Row>
            <Field label="TAX $" value={tax} onChangeText={setTax} keyboardType="decimal-pad" testID="calc-tax" />
            <Field label="EXTRA $" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" testID="calc-extra" />
          </Row>

          <View style={s.preview}>
            <PreviewLine label="Est. fees" value={`$${localCalc.fees.toFixed(2)}`} />
            <PreviewLine label="Net profit" value={`$${localCalc.net.toFixed(2)}`} />
            <PreviewLine label="ROI" value={`${localCalc.roi.toFixed(1)}%`} />
          </View>

          <Pressable
            testID="calc-check-button"
            style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9 }]}
            onPress={onCheck}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.primaryText} /> : <Text style={s.primaryBtnText}>Check this deal</Text>}
          </Pressable>
          <Pressable
            testID="calc-score-button"
            style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.85 }]}
            onPress={onScore}
            disabled={scoring || !itemName.trim()}
          >
            {scoring ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="speedometer" size={16} color={colors.text} />
                <Text style={s.secondaryBtnText}>Profit Scout Score</Text>
              </>
            )}
          </Pressable>
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        {result ? (
          <View style={s.card}>
            <View style={[s.verdictBox, { backgroundColor: vc.bg, borderColor: vc.border }]}>
              <Text style={[s.verdictHeader, { color: vc.fg }]} testID="calc-verdict">{result.verdict}</Text>
              <Text style={[s.verdictSub, { color: vc.fg }]}>
                Net ${result.net_profit?.toFixed?.(2) ?? result.net_profit} • ROI {result.roi_pct}%
              </Text>
            </View>
            {result.explanation ? (
              <View style={s.aiBox}>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
                <Text style={s.aiText}>{result.explanation}</Text>
              </View>
            ) : null}
            <View style={s.kpiGrid}>
              <Kpi label="eBay fee" value={`$${result.ebay_fee}`} />
              <Kpi label="Total cost" value={`$${result.total_cost}`} />
            </View>
            <View style={s.kpiGrid}>
              <Kpi label="Profit margin" value={`${result.profit_margin_pct ?? 0}%`} />
              <Kpi label="Break-even price" value={`$${result.break_even_price ?? 0}`} />
            </View>
          </View>
        ) : null}
        {score ? (
          <View style={s.card}>
            <View style={s.scoreHeader}>
              <View>
                <Text style={s.scoreLabel}>PROFIT SCOUT SCORE</Text>
                <Text style={[s.scoreValue, { color: scoreColor }]} testID="calc-score-value">
                  {score.score}<Text style={{ fontSize: 16, color: colors.textMuted }}>/100</Text>
                </Text>
              </View>
              <View style={[s.scoreVerdictPill, { backgroundColor: scoreColor }]}>
                <Text style={s.scoreVerdictText}>{score.verdict}</Text>
              </View>
            </View>
            <View style={s.subscoreGrid}>
              {Object.entries(score.subscores).map(([k, v]: any) => (
                <View key={k} style={s.subscore}>
                  <Text style={s.subscoreKey}>{k.toUpperCase()}</Text>
                  <View style={s.subscoreBarTrack}>
                    <View style={[s.subscoreBarFill, { width: `${v}%`, backgroundColor: v >= 70 ? colors.good : v >= 45 ? colors.warn : colors.bad }]} />
                  </View>
                  <Text style={s.subscoreValue}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ children }: any) {
  return <View style={{ flexDirection: "row", gap: spacing.sm }}>{children}</View>;
}

function Field({ label, ...rest }: any) {
  return (
    <View style={{ flex: 1, marginTop: spacing.sm }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={colors.textSubtle} {...rest} />
    </View>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.previewRow}>
      <Text style={s.previewLabel}>{label}</Text>
      <Text style={s.previewValue}>{value}</Text>
    </View>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  label: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: "#f8fafc",
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  preview: {
    marginTop: spacing.md,
    backgroundColor: "#f1f5f9",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  previewRow: { flexDirection: "row", justifyContent: "space-between" },
  previewLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  previewValue: { fontSize: 13, color: colors.text, fontWeight: "700" },
  primaryBtn: {
    marginTop: spacing.md,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
  secondaryBtn: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "700" },
  scoreHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
  scoreValue: { fontSize: 44, fontWeight: "900", marginTop: 4 },
  scoreVerdictPill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  scoreVerdictText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
  subscoreGrid: { gap: 6, marginTop: spacing.md },
  subscore: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  subscoreKey: { fontSize: 10, color: colors.textMuted, fontWeight: "700", width: 88, letterSpacing: 0.5 },
  subscoreBarTrack: { flex: 1, height: 8, backgroundColor: "#f1f5f9", borderRadius: radius.pill, overflow: "hidden" },
  subscoreBarFill: { height: "100%" },
  subscoreValue: { width: 32, textAlign: "right", fontSize: 12, fontWeight: "800", color: colors.text },
  error: { color: colors.bad, fontSize: 12, marginTop: spacing.sm, textAlign: "center" },
  verdictBox: {
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  verdictHeader: { fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  verdictSub: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  aiBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: "#eff6ff",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  aiText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  kpiGrid: { flexDirection: "row", gap: spacing.sm },
  kpi: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  kpiLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
  kpiValue: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 4 },
});
