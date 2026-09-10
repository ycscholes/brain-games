import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useUserDataChange } from "../../services/user-data/hooks/useUserDataChange";
import {
  readPetData,
  syncPetData,
  feedPet,
  adoptPet,
  getNextAdoptionCost,
} from "../../utils/petStorage";
import { usePageShare } from "../../utils/share";
import {
  type FoodItem,
  type PetData,
  type PetSkin,
  type PetStorageData,
  getFoodItemsForPetSkin,
  MAX_HUNGER,
} from "../../domain/pet/types";
import CustomPetFlow from "./components/CustomPetFlow";
import PetAdoptionPanel from "./components/PetAdoptionPanel";
import PetOverviewPanel, { type PetFeedBurst } from "./components/PetOverviewPanel";
import type { PetSpriteMood } from "../../domain/pet/sprite";
import { deleteCustomPet } from "../../services/custom-pet/customPetService";
import "./index.scss";

type PetFeedbackKind = "idle" | "switch" | "feed" | "cuddle" | "error";

export default function PetPage() {
  usePageShare("pages/pet/index");

  const [storageData, setStorageData] = useState<PetStorageData>(() => readPetData());
  const [newName, setNewName] = useState("");
  const [selectedSkin, setSelectedSkin] = useState<PetSkin>("cat");
  const [showAdoptionDialog, setShowAdoptionDialog] = useState(false);
  const [showPetPickerDialog, setShowPetPickerDialog] = useState(false);
  const [showCustomPetFlow, setShowCustomPetFlow] = useState(false);
  const [petMotion, setPetMotion] = useState<PetSpriteMood>("idle");
  const [feedbackKind, setFeedbackKind] = useState<PetFeedbackKind>("idle");
  const [feedBurst, setFeedBurst] = useState<PetFeedBurst | null>(null);
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
        food,
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
    const nextData = options?.syncPets ? syncPetData({ markChanged: false }) : readPetData();
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
  const orderedPets = useMemo(
    () =>
      [...pets].sort((left, right) => {
        if (left.status === "dead" && right.status !== "dead") return 1;
        if (left.status !== "dead" && right.status === "dead") return -1;
        return 0;
      }),
    [pets],
  );
  const activePet = pets.find((pet) => pet.id === storageData.activePetId) || null;
  const activePetId = activePet?.id;
  const activePetStatus = activePet?.status;
  const nextAdoptionCost = getNextAdoptionCost(storageData);
  const foodItems = useMemo(
    () => getFoodItemsForPetSkin(activePet?.skin || selectedSkin),
    [activePet?.skin, selectedSkin],
  );

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
    if (activePetStatus) {
      playPetMotion(activePetStatus === "dead" ? "idle" : "cuddle", 720);
      playFeedback("switch", 1100);
    }
  }, [activePetId, activePetStatus, playFeedback, playPetMotion]);

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

      const food = foodItems.find((item) => item.id === foodId);
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
    },
    [activePet, foodItems, playFeedback, playPetMotion, showFeedBurst],
  );

  const handleCuddle = useCallback(() => {
    if (activePet && activePet.status !== "dead") {
      playPetMotion("cuddle", 820);
      playFeedback("cuddle", 1300);
    }
  }, [activePet, playFeedback, playPetMotion]);

  const handleDeleteCustomPet = useCallback(
    async (pet: PetData) => {
      const confirmed = await Taro.showModal({
        title: `永久删除 ${pet.name}？`,
        content: "原图、生成图片和宠物数据都会删除。之后仍可重新生成新的自定义宠物。",
        confirmText: "永久删除",
        confirmColor: "#b33a2f",
      });
      if (!confirmed.confirm) return;
      try {
        await deleteCustomPet(pet.id);
        loadAndRefreshPets();
        setShowPetPickerDialog(false);
        Taro.showToast({ title: "已提交永久删除", icon: "success" });
      } catch (error) {
        Taro.showToast({
          title: error instanceof Error ? error.message : "删除失败",
          icon: "none",
        });
      }
    },
    [loadAndRefreshPets],
  );

  const hungerPercent = getHungerPercent(activePet);
  const statusText = activePet ? getStatusText(activePet) : "等待领养";
  return (
    <View className="pet-page">
      <PetOverviewPanel
        pets={pets}
        orderedPets={orderedPets}
        activePet={activePet}
        activePetId={storageData.activePetId ?? undefined}
        selectedSkin={selectedSkin}
        balance={storageData.balance}
        hungerPercent={hungerPercent}
        statusText={statusText}
        activePetLine={activePetLine}
        feedbackKind={feedbackKind}
        petMotion={petMotion}
        feedBurst={feedBurst}
        foodItems={foodItems}
        showPetPickerDialog={showPetPickerDialog}
        getStatusText={getStatusText}
        onOpenPetPicker={() => setShowPetPickerDialog(true)}
        onOpenAdoption={() => setShowAdoptionDialog(true)}
        onClosePetPicker={() => setShowPetPickerDialog(false)}
        onSelectPet={handleSelectPet}
        onDeleteCustomPet={handleDeleteCustomPet}
        onCuddle={handleCuddle}
        onFeed={(food) => handleFeed(food.id)}
      />
      <PetAdoptionPanel
        visible={showAdoptionDialog}
        nextAdoptionCost={nextAdoptionCost}
        selectedSkin={selectedSkin}
        newName={newName}
        onClose={closeAdoptionDialog}
        onSkinChange={setSelectedSkin}
        onNameChange={setNewName}
        onAdopt={handleAdoptPet}
        onOpenCustomPet={() => {
          setShowAdoptionDialog(false);
          setShowCustomPetFlow(true);
        }}
      />
      {showCustomPetFlow ? (
        <CustomPetFlow
          onClose={() => setShowCustomPetFlow(false)}
          onAdopted={() => {
            setShowCustomPetFlow(false);
            loadAndRefreshPets();
          }}
        />
      ) : null}
    </View>
  );
}
