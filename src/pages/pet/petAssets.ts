import type { PetData, PetSkin } from "./types";

export type StandardPetAssetRef = {
  kind: "standard";
  skin: PetSkin;
};

export type CustomPetAssetRef = {
  kind: "custom";
  templateSkin: PetSkin;
  customAssetId: string;
};

export type PetAssetRef = StandardPetAssetRef | CustomPetAssetRef;

export function createStandardPetAssetRef(skin: PetSkin): StandardPetAssetRef {
  return {
    kind: "standard",
    skin,
  };
}

export function createCustomPetAssetRef(
  templateSkin: PetSkin,
  customAssetId: string,
): CustomPetAssetRef {
  return {
    kind: "custom",
    templateSkin,
    customAssetId,
  };
}

export function getPetAssetRef(pet: Pick<PetData, "skin" | "assetRef">): PetAssetRef {
  return pet.assetRef ?? createStandardPetAssetRef(pet.skin);
}

export function getPetTemplateSkin(pet: Pick<PetData, "skin" | "assetRef">): PetSkin {
  const assetRef = getPetAssetRef(pet);
  return assetRef.kind === "custom" ? assetRef.templateSkin : assetRef.skin;
}

export function getPetAssetKey(assetRef: PetAssetRef): string {
  return assetRef.kind === "custom"
    ? `custom:${assetRef.customAssetId}`
    : `standard:${assetRef.skin}`;
}
