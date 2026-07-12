/** HarvestHub palette — Teal primary + Yellow + Coral / Flag Red + Pale Sky */
export const colors = {
  // Core palette
  deepBlue: "#0B3954",
  teal: "#087E8B",
  paleSky: "#BFD7EA",
  yellow: "#F5C518",
  yellowSoft: "rgba(245,197,24,0.22)",
  coral: "#FF5A5F",
  flagRed: "#C81D25",

  // Mapped UI tokens
  bg: "#F2F7FA",
  surface: "#FFFFFF",
  ink: "#0B3954",
  muted: "#5A7A8C",
  line: "#C5D9E8",
  placeholder: "#8AA4B5",
  /** Primary actions / FAB / active tabs */
  accent: "#087E8B",
  accentSoft: "rgba(8,126,139,0.14)",
  accentBorder: "rgba(8,126,139,0.35)",
  /** Secondary highlight (filters, badges) */
  highlight: "#F5C518",
  highlightSoft: "rgba(245,197,24,0.2)",
  padBg: "#E4EEF5",
  rail: "#E8F1F7",
  well: "#EAF3F8",
  toggleTrack: "#D5E6F0",
  danger: "#C81D25",
  dangerSoft: "rgba(200,29,37,0.12)",
  warn: "#FF5A5F",
  warnSoft: "rgba(255,90,95,0.14)",
  success: "#087E8B",
  successSoft: "rgba(8,126,139,0.12)",
  feature: "#BFD7EA",
  featureInk: "#0B3954",
  dash: "#A8C4D8",
};

export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 28 };

export const radius = {
  sm: 11,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  sheet: 30,
  pill: 999,
};

export const font = {
  regular: "Lato_400Regular",
  medium: "Lato_400Regular",
  semibold: "Lato_700Bold",
  bold: "Lato_700Bold",
  extrabold: "Lato_900Black",
};

/** Category wells tinted from pale sky */
export const categoryTints: Record<string, string> = {
  Rajma: "#D6E8F2",
  Kabli: "#C9DFEC",
  Chana: "#E2EEF5",
  Matar: "#BFD7EA",
  Urad: "#D0E4F0",
  Moong: "#C5DCE9",
  Masoor: "#DCEAF3",
  Lobiya: "#B8D4E6",
  Besan: "#E8F0C8",
};
