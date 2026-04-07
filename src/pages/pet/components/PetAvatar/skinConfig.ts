import type { PetSkin } from "../../types";

export interface PetSkinTheme {
  primary: string;
  secondary: string;
  accent: string;
  belly: string;
  blush: string;
  earInner: string;
  spot: string;
}

export const PET_SKIN_THEMES: Record<PetSkin, PetSkinTheme> = {
  cat: {
    primary: "#f2b67d",
    secondary: "#d98848",
    accent: "#c56d22",
    belly: "#fff4e4",
    blush: "#f6b3b0",
    earInner: "#ffd8c4",
    spot: "#fff9f1",
  },
  dog: {
    primary: "#d7b08a",
    secondary: "#9f7d59",
    accent: "#7b5734",
    belly: "#fff8f0",
    blush: "#f4c2b8",
    earInner: "#f4dcc7",
    spot: "#fdf1e2",
  },
  rabbit: {
    primary: "#f2d4de",
    secondary: "#d89ab4",
    accent: "#c06c94",
    belly: "#fff8fb",
    blush: "#ffb9d1",
    earInner: "#ffe3ec",
    spot: "#fff4f8",
  },
  bear: {
    primary: "#c69a73",
    secondary: "#92633f",
    accent: "#6f4528",
    belly: "#fef0dc",
    blush: "#efbeaa",
    earInner: "#f6d8bd",
    spot: "#fff5eb",
  },
  panda: {
    primary: "#e8ecef",
    secondary: "#5f6670",
    accent: "#31363f",
    belly: "#fffdf9",
    blush: "#d7dbe0",
    earInner: "#c5cbd3",
    spot: "#ffffff",
  },
};
