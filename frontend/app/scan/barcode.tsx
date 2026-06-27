import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type Capture = { code: string; type: string; status: string; message: string };

export default function ScanBarcode() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const onScanned = async ({ data, type }: { data: string; type: string }) => {
    if (capture || loading) return;
    setLoading(true);
    try {
      const res = await api<{ barcode: string; barcode_type: string; lookup_status: string; lookup_message: string }>(
        "/scan/identify-barcode",
        { method: "POST", body: { barcode: data, type } },
      );
      setCapture({
        code: res.barcode,
        type: res.barcode_type || type || "unknown",
        status: res.lookup_status,
        message: res.lookup_message,
      });
    } catch (e: any) {
      Alert.alert("Lookup failed", e.message || "Try again");
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.permSafe} edges={["top", "bottom"]}>
        <View style={s.permWrap}>
          <Ionicons name="camera-off" size={40} color={colors.textMuted} />
          <Text style={s.permTitle}>Camera permission needed</Text>
          <Text style={s.permText}>We use the camera to scan product barcodes.</Text>
          {permission.canAskAgain ? (
            <Pressable testID="scan-grant-perm" onPress={requestPermission} style={s.permBtn}>
              <Text style={s.permBtnText}>Grant camera access</Text>
            </Pressable>
          ) : (
            <Pressable testID="scan-open-settings" onPress={() => Linking.openSettings()} style={s.permBtn}>
              <Text style={s.permBtnText}>Open Settings</Text>
            </Pressable>
          )}
          <Pressable testID="scan-manual-fallback" onPress={() => router.replace("/scan/manual")} style={s.permLink}>
            <Text style={s.permLinkText}>Use manual search instead</Text>
          </Pressable>
          <Pressable testID="scan-close" onPress={() => router.back()} style={s.permLink}>
            <Text style={s.permLinkText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Captured screen — show value + fallbacks instead of fake product
  if (capture) {
    return (
      <SafeAreaView style={s.permSafe} edges={["top", "bottom"]}>
        <View style={s.captured}>
          <View style={s.topRow}>
            <Pressable testID="cap-close" onPress={() => router.back()}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={s.captureTitle}>Barcode captured</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={s.captureCard}>
            <Text style={s.label}>BARCODE VALUE</Text>
            <Text testID="cap-code" style={s.codeValue} selectable>{capture.code}</Text>

            <View style={s.detailsRow}>
              <View style={s.detailCell}>
                <Text style={s.label}>TYPE</Text>
                <Text style={s.detailText}>{capture.type}</Text>
              </View>
              <View style={s.detailCell}>
                <Text style={s.label}>LOOKUP</Text>
                <Text style={[s.detailText, { color: colors.warn }]}>{capture.status}</Text>
              </View>
            </View>

            <View style={s.warnBox}>
              <Ionicons name="information-circle" size={18} color={colors.warn} />
              <Text style={s.warnText}>{capture.message}</Text>
            </View>

            <Text style={s.label}>FINAL SEARCH QUERY</Text>
            <Text testID="cap-final-query" style={s.queryValue}>{capture.code}</Text>
          </View>

          <View style={s.actions}>
            <Pressable
              testID="cap-search-code"
              style={s.primaryBtn}
              onPress={() =>
                router.replace({ pathname: "/product", params: { q: capture.code, source: "barcode" } })
              }
            >
              <Ionicons name="search" size={18} color={colors.primaryText} />
              <Text style={s.primaryBtnText}>Search this code</Text>
            </Pressable>
            <Pressable
              testID="cap-use-camera-ai"
              style={s.secondaryBtn}
              onPress={() => router.replace("/scan/camera")}
            >
              <Ionicons name="camera" size={18} color={colors.text} />
              <Text style={s.secondaryBtnText}>Try camera AI instead</Text>
            </Pressable>
            <Pressable
              testID="cap-use-manual"
              style={s.secondaryBtn}
              onPress={() => router.replace("/scan/manual")}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={s.secondaryBtnText}>Enter manually</Text>
            </Pressable>
            <Pressable testID="cap-rescan" onPress={() => setCapture(null)} style={s.tertiary}>
              <Text style={s.tertiaryText}>Scan another</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.safe}>
      <CameraView
        testID="barcode-camera-view"
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={onScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr", "code39"],
        }}
      />
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frame} />
      </View>
      <SafeAreaView style={s.topBar} edges={["top"]}>
        <Pressable testID="scan-close-button" onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={s.topTitle}>Scan barcode</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>
      <SafeAreaView style={s.bottomBar} edges={["bottom"]}>
        <Pressable testID="scan-manual-button" style={s.fallback} onPress={() => router.replace("/scan/manual")}>
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={s.fallbackText}>Enter manually</Text>
        </Pressable>
      </SafeAreaView>
      {loading ? (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={s.loadingText}>Reading barcode…</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  permSafe: { flex: 1, backgroundColor: colors.bg },
  permWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  permTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  permText: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  permBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  permBtnText: { color: colors.primaryText, fontWeight: "700" },
  permLink: { padding: spacing.sm },
  permLinkText: { color: colors.accent, fontWeight: "600" },
  captured: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  captureTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  captureCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  codeValue: { fontSize: 22, fontWeight: "900", color: colors.text, fontFamily: "Courier" },
  detailsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  detailCell: { flex: 1 },
  detailText: { fontSize: 14, fontWeight: "700", color: colors.text },
  warnBox: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.warnBg,
    borderColor: colors.warnBorder,
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginVertical: spacing.sm,
  },
  warnText: { flex: 1, color: "#7c5e0a", fontSize: 12, lineHeight: 17 },
  queryValue: { fontSize: 15, fontWeight: "700", color: colors.text, fontFamily: "Courier" },
  actions: { gap: spacing.sm },
  primaryBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryBtnText: { color: colors.primaryText, fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
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
  tertiary: { padding: spacing.sm, alignItems: "center" },
  tertiaryText: { color: colors.accent, fontWeight: "700" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 270,
    height: 170,
    borderColor: "#fff",
    borderWidth: 3,
    borderRadius: radius.lg,
    backgroundColor: "transparent",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingBottom: spacing.lg },
  fallback: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  fallbackText: { color: "#fff", fontWeight: "600" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { color: "#fff", fontSize: 14 },
});
