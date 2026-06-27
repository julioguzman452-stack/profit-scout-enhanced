import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type Comp = {
  id: string;
  item_name: string;
  price: number;
  location?: string;
  note?: string;
  created_at: string;
};

export default function FbMarketplace() {
  const router = useRouter();
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Comp[]>("/fb-comps");
      setComps(r);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openFb = () => {
    const q = item.trim() || "items for sale";
    const url = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(q)}`;
    Linking.openURL(url).catch(() => {});
  };

  const add = async () => {
    if (!item.trim() || !price.trim()) {
      Alert.alert("Item and price required");
      return;
    }
    setLoading(true);
    try {
      await api("/fb-comps", {
        method: "POST",
        body: {
          item_name: item.trim(),
          price: parseFloat(price) || 0,
          location: location.trim(),
          note: note.trim(),
        },
      });
      setPrice("");
      setLocation("");
      setNote("");
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e.message || "");
    } finally {
      setLoading(false);
    }
  };

  const remove = (id: string) =>
    Alert.alert("Delete comp?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/fb-comps/${id}`, { method: "DELETE" });
            setComps((c) => c.filter((x) => x.id !== id));
          } catch (e: any) {
            Alert.alert("Failed", e.message || "");
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <Pressable testID="fb-back" onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>FB Marketplace</Text>
            <Text style={s.sub}>Local price comparison (manual)</Text>
          </View>
        </View>

        <FlatList
          data={comps}
          keyExtractor={(c) => c.id}
          contentContainerStyle={s.scroll}
          ListHeaderComponent={
            <>
              <View style={s.formCard}>
                <Text style={s.label}>SEARCH ITEM</Text>
                <TextInput
                  testID="fb-item-input"
                  style={s.input}
                  value={item}
                  onChangeText={setItem}
                  placeholder="e.g. Nintendo Switch"
                  placeholderTextColor={colors.textSubtle}
                />
                <Pressable testID="fb-open-button" onPress={openFb} style={s.fbBtn}>
                  <Ionicons name="logo-facebook" size={18} color={colors.primaryText} />
                  <Text style={s.fbBtnText}>Open in Facebook Marketplace</Text>
                </Pressable>

                <View style={s.divider} />

                <Text style={s.label}>PASTE A LOCAL LISTING</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TextInput
                    testID="fb-price-input"
                    style={[s.input, { flex: 1 }]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="$ Price"
                    placeholderTextColor={colors.textSubtle}
                  />
                  <TextInput
                    testID="fb-location-input"
                    style={[s.input, { flex: 1 }]}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Location"
                    placeholderTextColor={colors.textSubtle}
                  />
                </View>
                <TextInput
                  testID="fb-note-input"
                  style={[s.input, { marginTop: spacing.sm }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Note (condition, distance…)"
                  placeholderTextColor={colors.textSubtle}
                />
                <Pressable
                  testID="fb-add-comp"
                  onPress={add}
                  disabled={loading}
                  style={s.addBtn}
                >
                  {loading ? <ActivityIndicator color={colors.primaryText} /> : <Text style={s.addBtnText}>Save comp</Text>}
                </Pressable>
              </View>

              <Text style={s.listTitle}>Saved comps</Text>
            </>
          }
          ListEmptyComponent={
            <Text style={s.empty}>Nothing saved yet.</Text>
          }
          renderItem={({ item: c }) => (
            <Pressable
              testID={`fb-comp-${c.id}`}
              onLongPress={() => remove(c.id)}
              style={s.compRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.compName} numberOfLines={1}>{c.item_name}</Text>
                <Text style={s.compMeta} numberOfLines={1}>
                  {c.location ? `${c.location} · ` : ""}{c.note || new Date(c.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={s.compPrice}>${c.price.toFixed(2)}</Text>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  sub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginTop: spacing.sm, marginBottom: 4 },
  input: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, fontSize: 15, color: colors.text, backgroundColor: "#f8fafc" },
  fbBtn: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "#1877f2",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  fbBtnText: { color: colors.primaryText, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.border, marginTop: spacing.lg },
  addBtn: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: colors.primaryText, fontWeight: "700" },
  listTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing.md },
  compRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  compName: { fontSize: 14, fontWeight: "700", color: colors.text },
  compMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  compPrice: { fontSize: 16, fontWeight: "800", color: colors.text },
});
