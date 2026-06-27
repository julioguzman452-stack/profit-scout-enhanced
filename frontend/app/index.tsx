import { Redirect } from "expo-router";

export default function Index() {
  // AuthGate in _layout will route to (auth) or (tabs); fallback redirect.
  return <Redirect href="/(tabs)" />;
}
