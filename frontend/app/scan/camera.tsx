import { useEffect, useRef, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type Detected = {
  product_name?: string;
  brand?: string;
  model?: string;
  category?: string;
  confidence?: number;
  ebay_search_keywords?: string[];
};

// Simple in-memory cache for recently identified items
const identificationCache = new Map<string, { result: Detected; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function ScanCamera() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState<Detected | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const isUsableMatch = (d: Detected): boolean => {
    if (!d) return false;
    const name = (d.product_name || "").trim().toLowerCase();
    if (!name || name === "unknown item" || name === "unknown" || name === "n/a") return false;
    if (typeof d.confidence === "number" && d.confidence < 0.35) return false;
    return true;
  };

  // Compress base64 image for faster transmission
  const compressImage = (b64: string): string => {
    // For very large images, we could further compress, but expo-camera
    // already returns quality 0.5 images. This is a placeholder for future optimization.
    return b64;
  };

  // Check cache before sending to AI
  const getCachedResult = (b64: string): Detected | null => {
    const hash = Math.abs(b64.length).toString(); // Simple hash based on size
    const cached = identificationCache.get(hash);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }
    return null;
  };

  // Store result in cache
  const cacheResult = (b64: string, result: Detected) => {
    const hash = Math.abs(b64.length).toString();
    identificationCache.set(hash, { result, timestamp: Date.now() });
  };

  const sendToAi = async (b64: string) => {
    setLoading(true);
    setNotFound(false);
    setErrorMsg(null);
    setDetected(null);
    try {
      // Check cache first
      const cached = getCachedResult(b64);
      if (cached && isUsableMatch(cached)) {
        setDetected(cached);
        setLoading(false);
        return;
      }

      // Compress image for faster transmission
      const compressed = compressImage(b64);

      const r = await api<Detected>("/scan/identify-image", {
        method: "POST",
        body: { image_base64: compressed },
        timeoutMs: 30_000,
      });

      if (isUsableMatch(r)) {
        cacheResult(b64, r);
        setDetected(r);
      } else {
        setNotFound(true);
        setErrorMsg(r?.product_name === "Unknown item"
          ? "Unable to identify product from image."
          : null);
      }
    } catch (e: any) {
      console.error("AI identification error:", e);
      setNotFound(true);
      const msg = typeof e?.detail === "string" ? e.detail : (e?.message || "");
      // Map common errors to friendly copy
      if (/timed out|timeout/i.test(msg)) {
        setErrorMsg("AI service timed out. Please try again.");
      } else if (/unavailable|API key|EMERGENT/i.test(msg)) {
        setErrorMsg("AI service unavailable. Please try again later.");
      } else if (/Image too large/i.test(msg)) {
        setErrorMsg("Image is too large. Retake at lower quality.");
      } else if (/Invalid image/i.test(msg)) {
        setErrorMsg("Invalid image. Please retake the photo.");
      } else {
        setErrorMsg(msg || "Unable to identify product. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onSnap = async () => {
    if (!cameraRef.current || loading) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, // Reduced from 0.6 for faster processing
        base64: true,
        skipProcessing: true,
      });
      if (!photo?.base64) {
        Alert.alert("Snap failed");
        return;
      }
      await sendToAi(photo.base64);
    } catch (e: any) {
      Alert.alert("Camera error", e.message || "");
    }
  };

  const onPickFromGallery = async () => {
    if (loading) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, // Reduced from 0.6 for faster processing
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    await sendToAi(res.assets[0].base64);
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
          <Text style={s.permText}>We use the camera to identify products with AI.</Text>
          {permission.canAskAgain ? (
            <Pressable testID="cam-grant" onPress={requestPermission} style={s.permBtn}>
              <Text style={s.permBtnText}>Grant camera access</Text>
            </Pressable>
          ) : (
            <Pressable testID="cam-open-settings" onPress={() => Linking.openSettings()} style={s.permBtn}>
              <Text style={s.permBtnText}>Open Settings</Text>
            </Pressable>
          )}
          <Pressable testID="cam-pick-instead" onPress={onPickFromGallery} style={s.permLink}>
            <Text style={s.permLinkText}>Pick photo from gallery instead</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={s.permLink}>
            <Text style={s.permLinkText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Detected confirmation screen
  if (detected) {
    return (
      <SafeAreaView style={s.permSafe} edges={["top", "bottom"]}>
        <View style={s.capturedWrap}>
          <View style={s.topRow}>
            <Pressable testID="det-back" onPress={() => setDetected(null)}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <Text style={s.captureTitle}>AI detection</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={s.detectedCard}>
            <View style={s.aiHeader}>
              <Ionicons name="sparkles" size={18} color={colors.accent} />
              <Text style={s.aiHeaderText}>Gemini identified:</Text>
            </View>
            <Text testID="det-name" style={s.detName}>{detected.product_name || "Unknown"}</Text>
            <View style={s.detGrid}>
              <Cell label="BRAND" value={detected.brand || "—"} />
              <Cell label="MODEL" value={detected.model || "—"} />
            </View>
            <View style={s.detGrid}>
              <Cell label="CATEGORY" value={detected.category || "—"} />
              <Cell label="CONFIDENCE" value={typeof detected.confidence === "number" ? `${Math.round(detected.confidence * 100)}%` : "—"} />
            </View>
            {detected.ebay_search_keywords && detected.ebay_search_keywords.length > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={s.label}>SUGGESTED KEYWORDS</Text>
                <Text style={s.kw}>{detected.ebay_search_keywords.join(" · ")}</Text>
              </View>
            ) : null}
          </View>

          <View style={s.actions}>
            <Pressable
              testID="det-search"
              style={s.primaryBtn}
              onPress={() =>
                router.replace({
                  pathname: "/product",
                  params: { q: detected.product_name || (detected.ebay_search_keywords?.[0] ?? ""), source: "camera" },
                })
              }
            >
              <Ionicons name="search" size={18} color={colors.primaryText} />
              <Text style={s.primaryBtnText}>Search this product</Text>
            </Pressable>
            <Pressable testID="det-retry" style={s.secondaryBtn} onPress={() => setDetected(null)}>
              <Ionicons name="refresh" size={18} color={colors.text} />
              <Text style={s.secondaryBtnText}>Try another photo</Text>
            </Pressable>
            <Pressable testID="det-manual" style={s.secondaryBtn} onPress={() => router.replace("/scan/manual")}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={s.secondaryBtnText}>Enter manually</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Not-found screen
  if (notFound) {
    return (
      <SafeAreaView style={s.permSafe} edges={["top", "bottom"]}>
        <View style={s.capturedWrap}>
          <View style={s.topRow}>
            <Pressable testID="nf-close" onPress={() => router.back()}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={s.captureTitle}>AI scan</Text>
            <View style={{ width: 26 }} />
          </View>
          <View style={s.notFoundCard}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.warn} />
            <Text style={s.notFoundTitle}>{errorMsg ? "AI could not identify this photo" : "No product detected"}</Text>
            <Text style={s.notFoundText}>{errorMsg || "Try again or enter item manually."}</Text>
          </View>
          <View style={s.actions}>
            <Pressable testID="nf-retry" style={s.primaryBtn} onPress={() => { setNotFound(false); setErrorMsg(null); }}>
              <Ionicons name="refresh" size={18} color={colors.primaryText} />
              <Text style={s.primaryBtnText}>Try again</Text>
            </Pressable>
            <Pressable testID="nf-manual" style={s.secondaryBtn} onPress={() => router.replace("/scan/manual")}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={s.secondaryBtnText}>Enter manually</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.safe}>
      <CameraView ref={cameraRef} testID="ai-camera-view" style={StyleSheet.absoluteFill} facing="back" />
      <View style={s.overlay} pointerEvents="none">
        <View style={s.hint}>
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={s.hintText}>Frame product, then tap shutter</Text>
        </View>
      </View>
      <SafeAreaView style={s.topBar} edges={["top"]}>
        <Pressable testID="cam-close-button" onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={s.topTitle}>AI Identify</Text>
        <Pressable testID="cam-pick-gallery" onPress={onPickFromGallery} style={s.iconBtn}>
          <Ionicons name="images" size={22} color="#fff" />
        </Pressable>
      </SafeAreaView>
      <SafeAreaView style={s.bottomBar} edges={["bottom"]}>
        <Pressable testID="cam-shutter-button" onPress={onSnap} disabled={loading} style={s.shutter}>
          <View style={s.shutterInner} />
        </Pressable>
      </SafeAreaView>
      {loading ? (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={s.loadingText}>AI is identifying…</Text>
        </View>
      ) : null}
    </View>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detCell}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.detValue} numberOfLines={1}>{value}</Text>
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
  capturedWrap: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  captureTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  detectedCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiHeaderText: { fontSize: 12, fontWeight: "700", color: colors.accent, letterSpacing: 0.5 },
  detName: { fontSize: 22, fontWeight: "800", color: colors.text },
  detGrid: { flexDirection: "row", gap: spacing.sm, marginTop: 6 },
  detCell: { flex: 1, backgroundColor: "#f1f5f9", padding: spacing.sm, borderRadius: radius.md },
  detValue: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 2 },
  label: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
  kw: { fontSize: 13, color: colors.text, marginTop: 4 },
  notFoundCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warnBorder,
  },
  notFoundTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: spacing.sm },
  notFoundText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
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
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "flex-end", paddingBottom: 150 },
  hint: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  hintText: { color: "#fff", fontWeight: "600" },
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
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { color: "#fff", fontSize: 14 },
});
