import type { PetAssetRef } from "../../../../domain/pet/assets";
import type { PetSkin, PetStatus } from "../../../../domain/pet/types";
import type { PetSpriteMood, PetSpriteSize } from "../../../../domain/pet/sprite";

export type { PetSpriteMood, PetSpriteSize } from "../../../../domain/pet/sprite";

export interface PetSpriteProps {
  skin: PetSkin;
  assetRef?: PetAssetRef;
  status?: PetStatus;
  mood?: PetSpriteMood;
  size?: PetSpriteSize;
  selected?: boolean;
  className?: string;
}
