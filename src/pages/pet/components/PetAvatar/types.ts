import type { PetSkin, PetStatus } from "../../types";

export type PetAvatarMood = "idle" | "feed" | "cuddle";
export type PetAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface PetAvatarProps {
  skin: PetSkin;
  status?: PetStatus;
  mood?: PetAvatarMood;
  size?: PetAvatarSize;
  selected?: boolean;
  className?: string;
}
