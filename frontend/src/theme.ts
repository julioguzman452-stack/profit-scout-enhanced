// Profit Scout AI — design tokens with light + dark palettes
export type ThemeMode = "light" | "dark";

const lightPalette = {
  bg: "#f8fafc",
  bgElevated: "#ffffff",
  card: "#ffffff",
  cardAlt: "#f1f5f9",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  primary: "#0f172a",
  primaryText: "#ffffff",
  accent: "#2563eb",
  accentBg: "#eff6ff",
  good: "#16a34a",
  goodBg: "#dcfce7",
  goodBorder: "#86efac",
  warn: "#ca8a04",
  warnBg: "#fef9c3",
  warnBorder: "#fde047",
  bad: "#dc2626",
  badBg: "#fee2e2",
  badBorder: "#fca5a5",
  overlay: "rgba(0,0,0,0.75)",
  inputBg: "#f8fafc",
};

const darkPalette = {
  bg: "#0b1220",
  bgElevated: "#111827",
  card: "#111827",
  cardAlt: "#1f2937",
  border: "#1f2937",
  borderStrong: "#334155",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  textSubtle: "#64748b",
  primary: "#e2e8f0",
  primaryText: "#0b1220",
  accent: "#60a5fa",
  accentBg: "#1e293b",
  good: "#22c55e",
  goodBg: "#052e1a",
  goodBorder: "#16a34a",
  warn: "#facc15",
  warnBg: "#3a2e07",
  warnBorder: "#ca8a04",
  bad: "#f87171",
  badBg: "#3b0d0d",
  badBorder: "#b91c1c",
  overlay: "rgba(0,0,0,0.85)",
  inputBg: "#1f2937",
};

export type Palette = typeof lightPalette;

export const getPalette = (mode: ThemeMode): Palette =>
  mode === "dark" ? darkPalette : lightPalette;

// Legacy export — most existing screens import { colors } directly and
// stay light-themed. New screens consume useColors() to respect dark mode.
export const colors = lightPalette;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export type Verdict = "BUY" | "MAYBE" | "DO NOT BUY";

export const verdictColor = (v: string, palette: Palette = lightPalette) => {
  const k = (v || "").toUpperCase();
  if (k === "BUY" || k === "PROFITABLE")
    return { fg: palette.good, bg: palette.goodBg, border: palette.goodBorder };
  if (k === "MAYBE" || k === "RISKY")
    return { fg: palette.warn, bg: palette.warnBg, border: palette.warnBorder };
  return { fg: palette.bad, bg: palette.badBg, border: palette.badBorder };
};

export const CURRENCIES: { code: string; symbol: string }[] = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "CAD", symbol: "C$" },
  { code: "AUD", symbol: "A$" },
];

export const currencySymbol = (code: string): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol || "$";
