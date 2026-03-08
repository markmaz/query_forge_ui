import { CustomizeLinks, LayoutItems, MixLayoutItems, ThemeColors, ThemeSidebar } from "../domain-model/Layout";

const buildColorTheme = (id: number, name: string, primary: string, secondary: string): ThemeColors => ({
  id,
  name,
  primary,
  secondary,
});

export const customizerLinks: CustomizeLinks[] = [
  { id: 2, link: "https://support.pixelstrap.com", image: "customizer/5.png", title: "Support" },
  { id: 3, link: "https://docs.pixelstrap.net/react/zono/document/", image: "customizer/2.png", title: "Document" },
  { id: 4, link: "https://landing.pixelstrap.net/react/zono/template/index.html", image: "customizer/4.png", title: "Check Features" },
  { id: 5, link: "https://themeforest.net/user/pixelstrap/portfolio", image: "customizer/3.png", title: "Buy Now" },
];

export const layoutTypes: LayoutItems[] = [
  { type: "ltr", label: "LTR" },
  { type: "rtl", label: "RTL" },
  { type: "box-layout", label: "Box" },
];

export const sideBarIconTypes: LayoutItems[] = [
  { type: "stroke", label: "Stroke" },
  { type: "fill", label: "Fill" },
];

export const lightColors: ThemeColors[] = [
  buildColorTheme(1, "color-1", "#2B5F60", "#C06240"),
  buildColorTheme(2, "color-2", "#1D5B79", "#468B97"),
  buildColorTheme(3, "color-3", "#372363", "#FE6A49"),
  buildColorTheme(4, "color-4", "#4b2a4b", "#FE7088"),
  buildColorTheme(5, "color-5", "#4b232d", "#8e6343"),
  buildColorTheme(6, "color-6", "#43B9B2", "#534686"),
];

export const darkColors: ThemeColors[] = [
  buildColorTheme(1, "color-1", "#2B5F60", "#C06240"),
  buildColorTheme(2, "color-2", "#1D5B79", "#468B97"),
  buildColorTheme(3, "color-3", "#372363", "#FE6A49"),
  buildColorTheme(4, "color-4", "#4b2a4b", "#FE7088"),
  buildColorTheme(5, "color-5", "#4b232d", "#8e6343"),
  buildColorTheme(6, "color-6", "#007a91", "#534686"),
];

export const mixLayouts: MixLayoutItems[] = [
  { value: "dark-sidebar", headerClass: "bg-light", sidebarClass: "bg-dark", bodyClass: "bg-light" },
  { value: "dark-only", headerClass: "bg-dark", sidebarClass: "bg-dark", bodyClass: "bg-dark" },
];

export const sidebarType: ThemeSidebar[] = [
  { type: "horizontal-wrapper", dataAttr: "normal-sidebar" },
  { type: "compact-wrapper", dataAttr: "compact-sidebar" },
];
