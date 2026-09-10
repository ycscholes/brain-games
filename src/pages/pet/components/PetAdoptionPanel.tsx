import { Input, Text, View } from "@tarojs/components";
import { PET_SKIN_NAME, type PetSkin } from "../../../domain/pet/types";
import PetSprite from "./PetSprite";

export interface PetAdoptionPanelProps {
  visible: boolean;
  nextAdoptionCost: number;
  selectedSkin: PetSkin;
  newName: string;
  onClose: () => void;
  onSkinChange: (skin: PetSkin) => void;
  onNameChange: (name: string) => void;
  onAdopt: () => void;
  onOpenCustomPet: () => void;
}

export default function PetAdoptionPanel({
  visible,
  nextAdoptionCost,
  selectedSkin,
  newName,
  onClose,
  onSkinChange,
  onNameChange,
  onAdopt,
  onOpenCustomPet,
}: PetAdoptionPanelProps) {
  if (!visible) {
    return null;
  }

  return (
    <View className="dialog-layer">
      <View className="dialog-backdrop" onClick={onClose} />
      <View className="game-dialog adoption-dialog">
        <View className="dialog-header">
          <View>
            <Text className="dialog-title">领养新宠物</Text>
            <Text className="dialog-subtitle">
              {nextAdoptionCost === 0
                ? "第一位伙伴免费加入小院"
                : `本次需要 ${nextAdoptionCost} 积分`}
            </Text>
          </View>
          <View className="dialog-close" onClick={onClose}>
            <Text className="dialog-close-text">×</Text>
          </View>
        </View>

        <View className="skin-rail">
          <View className="skin-rail-track">
            {(Object.keys(PET_SKIN_NAME) as PetSkin[]).map((skin) => (
              <View
                key={skin}
                className={`skin-token ${selectedSkin === skin ? "skin-token-selected" : ""}`}
                onClick={() => onSkinChange(skin)}
              >
                <PetSprite skin={skin} size="sm" selected={selectedSkin === skin} />
                <Text className="skin-name">{PET_SKIN_NAME[skin]}</Text>
              </View>
            ))}
          </View>
        </View>

        <Input
          className="name-input"
          placeholder="给新伙伴起个名字"
          value={newName}
          onInput={(event) => onNameChange(event.detail.value)}
          maxlength={10}
        />

        <View
          className={`stage-button confirm-button ${!newName.trim() ? "button-disabled" : ""}`}
          onClick={onAdopt}
        >
          <Text className="stage-button-text">
            {nextAdoptionCost === 0 ? "免费领养" : `${nextAdoptionCost} 积分领养`}
          </Text>
        </View>
        <View className="stage-button custom-adoption-button" onClick={onOpenCustomPet}>
          <Text className="stage-button-text">AI 自定义宠物 · 300 积分</Text>
        </View>
      </View>
    </View>
  );
}
