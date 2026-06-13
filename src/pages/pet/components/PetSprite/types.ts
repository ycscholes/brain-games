import type { PetSkin, PetStatus } from "../../types";
import type { PetAssetRef } from "../../petAssets";

export type PetSpriteMood = "idle" | "feed" | "cuddle" | "hungry";
export type PetSpriteSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl";

export interface PetSpriteProps {
  skin: PetSkin;
  assetRef?: PetAssetRef;
  status?: PetStatus;
  mood?: PetSpriteMood;
  size?: PetSpriteSize;
  selected?: boolean;
  className?: string;
}
