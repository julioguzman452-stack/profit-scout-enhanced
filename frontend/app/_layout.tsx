import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { PrefsProvider, usePrefs } from "@/src/context/PrefsContext";

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const { colors, mode } = usePrefs();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan/barcode" options={{ presentation: "modal" }} />
        <Stack.Screen name="scan/camera" options={{ presentation: "modal" }} />
        <Stack.Screen name="scan/manual" options={{ presentation: "modal" }} />
        <Stack.Screen name="product" />
        <Stack.Screen name="pallet/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="pallet/[id]" />
        <Stack.Screen name="inventory/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="inventory/[id]" />
        <Stack.Screen name="history" />
        <Stack.Screen name="fb-marketplace" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
