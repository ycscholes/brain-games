import type { PetSkin, PetStatus } from "../../types";

export type PetSpriteMood = "idle" | "feed" | "cuddle" | "hungry";
export type PetSpriteSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl";

export interface PetSpriteProps {
  skin: PetSkin;
  status?: PetStatus;
  mood?: PetSpriteMood;
  size?: PetSpriteSize;
  selected?: boolean;
  className?: string;
}
