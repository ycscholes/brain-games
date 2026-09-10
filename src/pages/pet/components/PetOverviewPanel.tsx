import { ScrollView, Text, View } from "@tarojs/components";
import type { FoodItem, PetData, PetSkin } from "../../../domain/pet/types";
import type { PetSpriteMood } from "../../../domain/pet/sprite";
import PetSprite from "./PetSprite";
import PetFoodPanel, { FoodIcon } from "./PetFoodPanel";

export interface PetFeedBurst {
  id: number;
  food: FoodItem;
}

export interface PetOverviewPanelProps {
  pets: PetData[];
  orderedPets: PetData[];
  activePet: PetData | null;
  activePetId: string | undefined;
  selectedSkin: PetSkin;
  balance: number;
  hungerPercent: number;
  statusText: string;
  activePetLine: string;
  feedbackKind: string;
  petMotion: PetSpriteMood;
  feedBurst: PetFeedBurst | null;
  foodItems: FoodItem[];
  showPetPickerDialog: boolean;
  getStatusText: (pet: PetData) => string;
  onOpenPetPicker: () => void;
  onOpenAdoption: () => void;
  onClosePetPicker: () => void;
  onSelectPet: (petId: string) => void;
  onDeleteCustomPet: (pet: PetData) => void;
  onCuddle: () => void;
  onFeed: (food: FoodItem) => void;
}

export default function PetOverviewPanel({
  pets,
  orderedPets,
  activePet,
  activePetId,
  selectedSkin,
  balance,
  hungerPercent,
  statusText,
  activePetLine,
  feedbackKind,
  petMotion,
  feedBurst,
  foodItems,
  showPetPickerDialog,
  getStatusText,
  onOpenPetPicker,
  onOpenAdoption,
  onClosePetPicker,
  onSelectPet,
  onDeleteCustomPet,
  onCuddle,
  onFeed,
}: PetOverviewPanelProps) {
  const canFeed = Boolean(activePet && activePet.status !== "dead");

  return (
    <>
      <View className="pet-stage">
        <View className="stage-sky">
          <View className="stage-cloud stage-cloud-left" />
          <View className="stage-cloud stage-cloud-right" />
        </View>
        <View className="stage-hills" />

        <View className="stage-hud" onClick={() => pets.length > 0 && onOpenPetPicker()}>
          <View className="stage-hud-panel">
            <View className="pet-hud-main">
              <Text className="pet-name-text">{activePet?.name || "空的小院"}</Text>
              <Text className={`pet-state-text pet-state-${activePet?.status || "empty"}`}>
                {statusText}
              </Text>
            </View>
            <View className="pet-hud-metrics">
              <View className="mini-hunger">
                <Text className="mini-hunger-label">饱食</Text>
                <View className="mini-hunger-track">
                  <View className="mini-hunger-fill" style={{ width: `${hungerPercent}%` }} />
                </View>
                <Text className="mini-hunger-value">{Math.round(hungerPercent)}%</Text>
              </View>
              <View className="resource-pill">
                <Text className="resource-label">积分</Text>
                <Text className="resource-value">{balance}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="stage-pet-zone" onClick={onCuddle}>
          <View className={`stage-speech speech-${feedbackKind}`}>
            <Text className="stage-speech-text">{activePetLine}</Text>
          </View>

          <View className="stage-pet-shadow" />
          {activePet ? (
            <PetSprite
              skin={activePet.skin}
              assetRef={activePet.assetRef}
              size="xl"
              status={activePet.status}
              mood={petMotion}
              selected
              className="stage-pet-sprite"
            />
          ) : (
            <PetSprite
              skin={selectedSkin}
              size="xl"
              mood="idle"
              className="stage-pet-sprite stage-pet-empty"
            />
          )}

          {feedBurst ? (
            <View key={feedBurst.id} className="feed-burst stage-feed-burst">
              <View className="feed-burst-food">
                <FoodIcon food={feedBurst.food} />
              </View>
              <Text className="feed-burst-value">+{feedBurst.food.restoreHunger}</Text>
              <Text className="feed-burst-cost">-{feedBurst.food.cost}分</Text>
            </View>
          ) : null}
        </View>

        <View className="stage-controls">
          {canFeed ? (
            <PetFoodPanel pet={activePet} foods={foodItems} balance={balance} onFeed={onFeed} />
          ) : null}

          <View className="stage-actions">
            {canFeed ? (
              <View className="stage-button action-cuddle" onClick={onCuddle}>
                <Text className="stage-button-icon">♡</Text>
                <Text className="stage-button-text">抚摸</Text>
              </View>
            ) : null}
            {pets.length > 0 ? (
              <View className="stage-button action-pick" onClick={onOpenPetPicker}>
                <Text className="stage-button-icon">⇄</Text>
                <Text className="stage-button-text">选择宠物</Text>
              </View>
            ) : null}
            <View className="stage-button adopt-button" onClick={onOpenAdoption}>
              <Text className="stage-button-icon">＋</Text>
              <Text className="stage-button-text">领养</Text>
            </View>
          </View>
        </View>
      </View>

      {showPetPickerDialog ? (
        <View className="dialog-layer">
          <View className="dialog-backdrop" onClick={onClosePetPicker} />
          <View className="game-dialog picker-dialog">
            <View className="dialog-header">
              <View>
                <Text className="dialog-title">选择伙伴</Text>
                <Text className="dialog-subtitle">让谁来到小院中央？</Text>
              </View>
              <View className="dialog-close" onClick={onClosePetPicker}>
                <Text className="dialog-close-text">×</Text>
              </View>
            </View>

            <ScrollView className="pet-picker-list" scrollY enhanced showScrollbar={false}>
              {orderedPets.map((pet) => (
                <View
                  key={pet.id}
                  className={`pet-picker-item ${activePetId === pet.id ? "pet-picker-item-active" : ""} ${pet.status === "dead" ? "pet-picker-item-dead" : ""}`}
                  onClick={() => onSelectPet(pet.id)}
                >
                  <View className="pet-picker-avatar">
                    <PetSprite
                      skin={pet.skin}
                      assetRef={pet.assetRef}
                      size="sm"
                      status={pet.status}
                      selected={activePetId === pet.id}
                    />
                  </View>
                  <View className="pet-picker-copy">
                    <Text className="pet-picker-name">{pet.name}</Text>
                    <Text className="pet-picker-status">{getStatusText(pet)}</Text>
                  </View>
                  {activePetId === pet.id ? <Text className="pet-picker-current">当前</Text> : null}
                  {pet.assetRef?.kind === "custom" ? (
                    <View
                      className="pet-picker-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDeleteCustomPet(pet);
                      }}
                    >
                      <Text>删除</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </>
  );
}
