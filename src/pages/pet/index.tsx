import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Input, ScrollView, Image } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useUserDataChange } from "../../services/user-data/hooks/useUserDataChange";
import {
  readPetData,
  syncPetData,
  feedPet,
  adoptPet,
  getNextAdoptionCost,
} from "../../utils/petStorage";
import {
  FoodItem,
  PetData,
  PetSkin,
  PetStorageData,
  FOOD_ITEMS,
  PET_SKIN_NAME,
  MAX_HUNGER,
} from "./types";
import PetSprite from "./components/PetSprite";
import type { PetSpriteMood } from "./components/PetSprite/types";
import { resolveFoodIconUrl } from "../../config/remoteAssets";
import "./index.scss";

type PetFeedbackKind = "idle" | "switch" | "feed" | "cuddle" | "error";

interface FeedBurst {
  id: number;
  emoji: string;
  restoreHunger: number;
  cost: number;
}

function FoodIcon({ food }: { food: FoodItem }) {
  const [iconUrl, setIconUrl] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setImageFailed(false);
    setIconUrl("");

    void resolveFoodIconUrl(food.id)
      .then((url) => {
        if (isCurrent) {
          setIconUrl(url);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setImageFailed(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [food.id]);

  if (iconUrl && !imageFailed) {
    return (
      <Image
        className="food-image"
        src={iconUrl}
        mode="aspectFit"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <Text className="food-emoji">{food.emoji}</Text>;
}

export default function PetPage() {
  const [storageData, setStorageData] = useState<PetStorageData>(() => readPetData());
  const [newName, setNewName] = useState("");
  const [selectedSkin, setSelectedSkin] = useState<PetSkin>("cat");
  const [showAdoptionDialog, setShowAdoptionDialog] = useState(false);
  const [showPetPickerDialog, setShowPetPickerDialog] = useState(false);
  const [petMotion, setPetMotion] = useState<PetSpriteMood>("idle");
  const [feedbackKind, setFeedbackKind] = useState<PetFeedbackKind>("idle");
  const [feedBurst, setFeedBurst] = useState<FeedBurst | null>(null);
  const petMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPetMotionTimer = useCallback(() => {
    if (petMotionTimerRef.current) {
      clearTimeout(petMotionTimerRef.current);
      petMotionTimerRef.current = null;
    }
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  const clearFeedBurstTimer = useCallback(() => {
    if (feedBurstTimerRef.current) {
      clearTimeout(feedBurstTimerRef.current);
      feedBurstTimerRef.current = null;
    }
  }, []);

  const playFeedback = useCallback(
    (kind: PetFeedbackKind, duration = 1300) => {
      clearFeedbackTimer();
      setFeedbackKind(kind);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackKind("idle");
        feedbackTimerRef.current = null;
      }, duration);
    },
    [clearFeedbackTimer],
  );

  const showFeedBurst = useCallback(
    (food: FoodItem) => {
      clearFeedBurstTimer();
      setFeedBurst({
        id: Date.now(),
        emoji: food.emoji,
        restoreHunger: food.restoreHunger,
        cost: food.cost,
      });
      feedBurstTimerRef.current = setTimeout(() => {
        setFeedBurst(null);
        feedBurstTimerRef.current = null;
      }, 1100);
    },
    [clearFeedBurstTimer],
  );

  const playPetMotion = useCallback(
    (motion: PetSpriteMood, duration = 900) => {
      clearPetMotionTimer();
      setPetMotion(motion);
      petMotionTimerRef.current = setTimeout(() => {
        setPetMotion("idle");
        petMotionTimerRef.current = null;
      }, duration);
    },
    [clearPetMotionTimer],
  );

  const loadAndRefreshPets = useCallback((options?: { syncPets?: boolean }) => {
    const nextData = options?.syncPets
      ? syncPetData({ markChanged: false })
      : readPetData();
    setStorageData(nextData);
    if (nextData.pets.length === 0) {
      setShowAdoptionDialog(true);
    }
  }, []);

  const loadAndRefreshPetsDeferred = useCallback(() => {
    loadAndRefreshPets();
    setTimeout(() => {
      loadAndRefreshPets({ syncPets: true });
    }, 300);
  }, [loadAndRefreshPets]);

  useDidShow(() => {
    loadAndRefreshPetsDeferred();
  });

  useUserDataChange(loadAndRefreshPets);

  const pets = storageData.pets;
  const activePet = pets.find((pet) => pet.id === storageData.activePetId) || null;
  const nextAdoptionCost = getNextAdoptionCost(storageData);

  const getHungerPercent = (pet: PetData | null) => {
    if (!pet) return 0;
    return (pet.hunger / MAX_HUNGER) * 100;
  };

  const getStatusText = (pet: PetData) => {
    if (pet.status === "dead") return "已离开";
    if (pet.status === "hungry") return "需要喂食";
    return "状态稳定";
  };

  const activePetLine = useMemo(() => {
    if (!activePet) {
      return "小院还空着，先领养第一位伙伴吧。";
    }

    if (activePet.status === "dead") {
      return `${activePet.name} 的小木牌还留在院子里。`;
    }

    if (feedbackKind === "feed") {
      return `${activePet.name} 吃饱了，开心地摇了摇尾巴。`;
    }

    if (feedbackKind === "cuddle") {
      return `${activePet.name} 贴过来蹭了蹭你。`;
    }

    if (feedbackKind === "switch") {
      return `${activePet.name} 跑到了小院中央。`;
    }

    if (feedbackKind === "error") {
      return "资源还差一点，先去完成训练吧。";
    }

    if (activePet.status === "hungry") {
      return `${activePet.name} 的肚子咕咕叫，想吃点东西。`;
    }

    return `${activePet.name} 正在小院里等你。`;
  }, [activePet, feedbackKind]);

  useEffect(() => {
    return () => {
      clearPetMotionTimer();
      clearFeedbackTimer();
      clearFeedBurstTimer();
    };
  }, [clearFeedBurstTimer, clearFeedbackTimer, clearPetMotionTimer]);

  useEffect(() => {
    if (activePet) {
      playPetMotion(activePet.status === "dead" ? "idle" : "cuddle", 720);
      playFeedback("switch", 1100);
    }
  }, [activePet?.id, activePet?.status, playFeedback, playPetMotion]);

  const closeAdoptionDialog = useCallback(() => {
    setShowAdoptionDialog(false);
    setNewName("");
  }, []);

  const handleSelectPet = useCallback(
    (petId: string) => {
      setStorageData((prev) => {
        const nextData = {
          ...prev,
          activePetId: petId,
        };
        Taro.setStorageSync("pet_data", JSON.stringify(nextData));
        return nextData;
      });
      setShowPetPickerDialog(false);
      playPetMotion("cuddle", 720);
      playFeedback("switch", 1100);
    },
    [playFeedback, playPetMotion],
  );

  const handleAdoptPet = useCallback(() => {
    if (!newName.trim()) {
      Taro.showToast({ title: "请给宠物起个名字", icon: "none" });
      return;
    }

    const result = adoptPet(newName.trim(), selectedSkin);
    if (!result.success) {
      Taro.showToast({
        title: `积分不足，还需要 ${result.cost - result.data.balance} 分`,
        icon: "none",
      });
      return;
    }

    setStorageData(result.data);
    setNewName("");
    setShowAdoptionDialog(false);
    playPetMotion("cuddle", 820);
    playFeedback("switch", 1200);
    Taro.showToast({
      title: result.cost === 0 ? "第一只宠物免费领养成功" : `${result.pet?.name} 加入了小院`,
      icon: "success",
    });
  }, [newName, playFeedback, playPetMotion, selectedSkin]);

  const handleFeed = useCallback(
    (foodId: string) => {
      if (!activePet) {
        return;
      }

      const food = FOOD_ITEMS.find((item) => item.id === foodId);
      if (!food) {
        return;
      }

      const result = feedPet(activePet.id, food.restoreHunger, food.cost);
      if (!result.success) {
        let message = "积分不够";
        if (result.pet && result.pet.status === "dead") {
          message = "已离开的宠物无法喂食";
        }
        playFeedback("error", 1200);
        Taro.showToast({
          title: message,
          icon: "none",
        });
        return;
      }

      setStorageData(result.data);
      playPetMotion("feed", 760);
      playFeedback("feed", 1400);
      showFeedBurst(food);
      Taro.showToast({
        title: `${result.pet?.name} 吃完了 ${food.name}`,
        icon: "success",
      });
    },
    [activePet, playFeedback, playPetMotion, showFeedBurst],
  );

  const handleCuddle = useCallback(() => {
    if (activePet && activePet.status !== "dead") {
      playPetMotion("cuddle", 820);
      playFeedback("cuddle", 1300);
    }
  }, [activePet, playFeedback, playPetMotion]);

  const renderAdoptionDialog = () => {
    if (!showAdoptionDialog) {
      return null;
    }

    return (
      <View className="dialog-layer">
        <View className="dialog-backdrop" onClick={closeAdoptionDialog} />
        <View className="game-dialog adoption-dialog">
          <View className="dialog-header">
            <View>
              <Text className="dialog-title">领养新宠物</Text>
              <Text className="dialog-subtitle">
                {nextAdoptionCost === 0 ? "第一位伙伴免费加入小院" : `本次需要 ${nextAdoptionCost} 积分`}
              </Text>
            </View>
            <View className="dialog-close" onClick={closeAdoptionDialog}>
              <Text className="dialog-close-text">×</Text>
            </View>
          </View>

          <ScrollView className="skin-rail" scrollX enhanced showScrollbar={false}>
            <View className="skin-rail-track">
              {(Object.keys(PET_SKIN_NAME) as PetSkin[]).map((skin) => (
                <View
                  key={skin}
                  className={`skin-token ${selectedSkin === skin ? "skin-token-selected" : ""}`}
                  onClick={() => setSelectedSkin(skin)}
                >
                  <PetSprite skin={skin} size="sm" selected={selectedSkin === skin} />
                  <Text className="skin-name">{PET_SKIN_NAME[skin]}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <Input
            className="name-input"
            placeholder="给新伙伴起个名字"
            value={newName}
            onInput={(e) => setNewName(e.detail.value)}
            maxlength={10}
          />

          <View
            className={`stage-button confirm-button ${!newName.trim() ? "button-disabled" : ""}`}
            onClick={handleAdoptPet}
          >
            <Text className="stage-button-text">
              {nextAdoptionCost === 0 ? "免费领养" : `${nextAdoptionCost} 积分领养`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPetPickerDialog = () => {
    if (!showPetPickerDialog) {
      return null;
    }

    return (
      <View className="dialog-layer">
        <View className="dialog-backdrop" onClick={() => setShowPetPickerDialog(false)} />
        <View className="game-dialog picker-dialog">
          <View className="dialog-header">
            <View>
              <Text className="dialog-title">选择伙伴</Text>
              <Text className="dialog-subtitle">让谁来到小院中央？</Text>
            </View>
            <View className="dialog-close" onClick={() => setShowPetPickerDialog(false)}>
              <Text className="dialog-close-text">×</Text>
            </View>
          </View>

          <ScrollView className="pet-picker-list" scrollY enhanced showScrollbar={false}>
            {pets.map((pet) => (
              <View
                key={pet.id}
                className={`pet-picker-item ${storageData.activePetId === pet.id ? "pet-picker-item-active" : ""} ${
                  pet.status === "dead" ? "pet-picker-item-dead" : ""
                }`}
                onClick={() => handleSelectPet(pet.id)}
              >
                <View className="pet-picker-avatar">
                  <PetSprite skin={pet.skin} size="sm" status={pet.status} selected={storageData.activePetId === pet.id} />
                </View>
                <View className="pet-picker-copy">
                  <Text className="pet-picker-name">{pet.name}</Text>
                  <Text className="pet-picker-status">{getStatusText(pet)}</Text>
                </View>
                {storageData.activePetId === pet.id ? (
                  <Text className="pet-picker-current">当前</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  const hungerPercent = getHungerPercent(activePet);
  const statusText = activePet ? getStatusText(activePet) : "等待领养";
  const canFeed = Boolean(activePet && activePet.status !== "dead");

  return (
    <View className="pet-page">
      <View className="pet-stage">
        <View className="stage-sky">
          <View className="stage-cloud stage-cloud-left" />
          <View className="stage-cloud stage-cloud-right" />
        </View>
        <View className="stage-hills" />

        <View className="stage-hud" onClick={() => pets.length > 0 && setShowPetPickerDialog(true)}>
          <View className="stage-hud-panel">
            <View className="pet-hud-main">
              <Text className="pet-name-text">{activePet?.name || "空的小院"}</Text>
              <Text className={`pet-state-text pet-state-${activePet?.status || "empty"}`}>{statusText}</Text>
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
                <Text className="resource-value">{storageData.balance}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="stage-pet-zone" onClick={handleCuddle}>
          <View className={`stage-speech speech-${feedbackKind}`}>
            <Text className="stage-speech-text">{activePetLine}</Text>
          </View>

          <View className="stage-pet-shadow" />
          {activePet ? (
            <PetSprite
              skin={activePet.skin}
              size="xl"
              status={activePet.status}
              mood={petMotion}
              selected
              className="stage-pet-sprite"
            />
          ) : (
            <PetSprite skin={selectedSkin} size="xl" mood="idle" className="stage-pet-sprite stage-pet-empty" />
          )}

          {feedBurst ? (
            <View key={feedBurst.id} className="feed-burst stage-feed-burst">
              <Text className="feed-burst-food">{feedBurst.emoji}</Text>
              <Text className="feed-burst-value">+{feedBurst.restoreHunger}</Text>
              <Text className="feed-burst-cost">-{feedBurst.cost}分</Text>
            </View>
          ) : null}
        </View>

        <View className="stage-controls">
          {canFeed ? (
            <View className="food-dock">
              {FOOD_ITEMS.map((food) => (
                <View
                  key={food.id}
                  className={`food-button ${storageData.balance >= food.cost ? "food-button-ready" : "food-button-disabled"}`}
                  onClick={() => handleFeed(food.id)}
                >
                  <View className="food-button-icon">
                    <FoodIcon food={food} />
                  </View>
                  <View className="food-button-copy">
                    <Text className="food-button-name">{food.name}</Text>
                    <Text className="food-button-cost">{food.cost}分</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View className="stage-actions">
            {canFeed ? (
              <View className="stage-button action-cuddle" onClick={handleCuddle}>
                <Text className="stage-button-icon">♡</Text>
                <Text className="stage-button-text">抚摸</Text>
              </View>
            ) : null}
            {pets.length > 0 ? (
              <View className="stage-button action-pick" onClick={() => setShowPetPickerDialog(true)}>
                <Text className="stage-button-icon">⇄</Text>
                <Text className="stage-button-text">选择宠物</Text>
              </View>
            ) : null}
            <View className="stage-button adopt-button" onClick={() => setShowAdoptionDialog(true)}>
              <Text className="stage-button-icon">＋</Text>
              <Text className="stage-button-text">领养</Text>
            </View>
          </View>
        </View>
      </View>

      {renderAdoptionDialog()}
      {renderPetPickerDialog()}
    </View>
  );
}
