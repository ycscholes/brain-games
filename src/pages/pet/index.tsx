import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Input, ScrollView } from "@tarojs/components";
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
  PetData,
  FoodItem,
  PetStorageData,
  PetSkin,
  FOOD_ITEMS,
  PET_SKIN_NAME,
  MAX_HUNGER,
} from "./types";
import PetSprite from "./components/PetSprite";
import type { PetSpriteMood } from "./components/PetSprite/types";
import "./index.scss";

type PetFeedbackKind = "idle" | "switch" | "feed" | "cuddle" | "error";

interface FeedBurst {
  id: number;
  emoji: string;
  restoreHunger: number;
  cost: number;
}

export default function PetPage() {
  const [storageData, setStorageData] = useState<PetStorageData>(() => readPetData());
  const [newName, setNewName] = useState("");
  const [selectedSkin, setSelectedSkin] = useState<PetSkin>("cat");
  const [showAdoptionPanel, setShowAdoptionPanel] = useState(false);
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
      setShowAdoptionPanel(true);
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
  const aliveCount = pets.filter((pet) => pet.status !== "dead").length;
  const deadCount = pets.length - aliveCount;
  const nextAdoptionCost = getNextAdoptionCost(storageData);

  const activePetLine = useMemo(() => {
    if (!activePet) {
      return "先领养一位小伙伴，小院就会热闹起来。";
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
      return `${activePet.name} 眨了眨眼，好像还差一点资源。`;
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

  const handleSelectPet = useCallback((petId: string) => {
    setStorageData((prev) => {
      const nextData = {
        ...prev,
        activePetId: petId,
      };
      Taro.setStorageSync("pet_data", JSON.stringify(nextData));
      return nextData;
    });
    playPetMotion("cuddle", 720);
    playFeedback("switch", 1100);
  }, [playFeedback, playPetMotion]);

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
    setShowAdoptionPanel(false);
    playPetMotion("cuddle", 820);
    playFeedback("switch", 1200);
    Taro.showToast({
      title: result.cost === 0 ? "第一只宠物免费领养成功" : `${result.pet?.name} 加入了小院`,
      icon: "success",
    });
  }, [newName, playFeedback, playPetMotion, selectedSkin]);

  const handleFeed = useCallback((foodId: string) => {
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
  }, [activePet, playFeedback, playPetMotion, showFeedBurst]);

  const getHungerPercent = (pet: PetData | null) => {
    if (!pet) return 0;
    return (pet.hunger / MAX_HUNGER) * 100;
  };

  const getHungerColor = (pet: PetData | null) => {
    const percent = getHungerPercent(pet);
    if (percent <= 20) return "#dc2626";
    if (percent <= 40) return "#f59e0b";
    return "#1f9d72";
  };

  const getStatusText = (pet: PetData) => {
    if (pet.status === "dead") return "已离开";
    if (pet.status === "hungry") return "需要喂食";
    return "状态稳定";
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}.${month}.${day} ${hour}:${minute}`;
  };

  const renderAdoptionPanel = () => (
    <View className="adoption-card">
      <View className="section-heading">
        <Text className="section-title">领养新宠物</Text>
        <Text className="section-desc">
          {nextAdoptionCost === 0
            ? "第一只宠物免费，先挑一个最喜欢的伙伴。"
            : `本次领养需要 ${nextAdoptionCost} 积分，支持同时照顾多只宠物。`}
        </Text>
      </View>

      <Text className="minor-title">选择外观</Text>
      <View className="skin-grid">
        {(Object.keys(PET_SKIN_NAME) as PetSkin[]).map((skin) => (
          <View
            key={skin}
            className={`skin-item ${selectedSkin === skin ? "skin-item-selected" : ""}`}
            onClick={() => setSelectedSkin(skin)}
          >
            <PetSprite skin={skin} size="sm" selected={selectedSkin === skin} />
            <Text className="skin-name">{PET_SKIN_NAME[skin]}</Text>
          </View>
        ))}
      </View>

      <Text className="minor-title">给它起个名字</Text>
      <Input
        className="name-input"
        placeholder="输入宠物名字"
        value={newName}
        onInput={(e) => setNewName(e.detail.value)}
        maxlength={10}
      />

      <View
        className={`primary-button ${!newName.trim() ? "button-disabled" : ""}`}
        onClick={handleAdoptPet}
      >
        <Text className="button-text">
          {nextAdoptionCost === 0 ? "免费领养" : `${nextAdoptionCost} 积分领养`}
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View className="empty-card">
      <View className="empty-pet">
        <PetSprite skin={selectedSkin} size="lg" mood="idle" />
      </View>
      <Text className="empty-title">小院里还没有宠物</Text>
      <Text className="empty-desc">先领养第一只宠物，之后可以继续扩充你的陪伴阵容。</Text>
    </View>
  );

  const renderHero = () => (
    <View className="hero-card">
      <View className="yard-sky">
        <View className="yard-cloud yard-cloud-left" />
        <View className="yard-cloud yard-cloud-right" />
      </View>
      <View className="hero-top">
        <View>
          <Text className="hero-eyebrow">Pet Yard</Text>
          <Text className="hero-title">我的宠物小院</Text>
          <Text className="hero-subtitle">
            今天的小院阳光很好，伙伴们等着你来照顾。
          </Text>
        </View>
        <View className="hero-badge">
          <View
            className="pet-sprite-action"
            onClick={() => {
              if (activePet && activePet.status !== "dead") {
                playPetMotion("cuddle", 760);
                playFeedback("cuddle", 1300);
              }
            }}
          >
            <PetSprite
              skin={activePet?.skin ?? selectedSkin}
              size="sm"
              mood={activePet ? petMotion : "idle"}
              status={activePet?.status}
            />
          </View>
        </View>
      </View>

      <View className="hero-stats">
        <View className="hero-stat-card">
          <Text className="hero-stat-value">{pets.length}</Text>
          <Text className="hero-stat-label">宠物总数</Text>
        </View>
        <View className="hero-stat-card">
          <Text className="hero-stat-value">{aliveCount}</Text>
          <Text className="hero-stat-label">存活中</Text>
        </View>
        <View className="hero-stat-card">
          <Text className="hero-stat-value">{storageData.balance}</Text>
          <Text className="hero-stat-label">可用积分</Text>
        </View>
        <View className="hero-stat-card">
          <Text className="hero-stat-value">{nextAdoptionCost}</Text>
          <Text className="hero-stat-label">下次领养</Text>
        </View>
      </View>

      {pets.length > 0 ? (
        <ScrollView className="pet-switcher" scrollX enhanced showScrollbar={false}>
          <View className="pet-switcher-track">
            {pets.map((pet) => (
              <View
                key={pet.id}
                className={`pet-chip ${storageData.activePetId === pet.id ? "pet-chip-active" : ""} ${
                  pet.status === "dead" ? "pet-chip-dead" : ""
                }`}
                onClick={() => handleSelectPet(pet.id)}
              >
                <View className="pet-chip-avatar">
                  <PetSprite
                    skin={pet.skin}
                    size="sm"
                    status={pet.status}
                    mood={storageData.activePetId === pet.id ? petMotion : "idle"}
                    selected={storageData.activePetId === pet.id}
                  />
                </View>
                <View className="pet-chip-copy">
                  <Text className="pet-chip-name">{pet.name}</Text>
                  <Text className="pet-chip-meta">{getStatusText(pet)}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      <View className="hero-actions">
        <View className="secondary-button" onClick={() => setShowAdoptionPanel((prev) => !prev)}>
          <Text className="button-icon">{showAdoptionPanel ? "▴" : "+"}</Text>
          <Text className="secondary-button-text">
            {showAdoptionPanel ? "收起领养面板" : "新增宠物"}
          </Text>
        </View>
        {activePet ? (
          <View className="hero-current">
            <Text className="hero-current-label">当前查看</Text>
            <View className="hero-current-row">
              <PetSprite
                skin={activePet.skin}
                size="xs"
                status={activePet.status}
                mood={petMotion}
                selected
              />
              <Text className="hero-current-value">{activePet.name}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View className={`speech-bubble speech-${feedbackKind}`}>
        <Text className="speech-text">{activePetLine}</Text>
      </View>
    </View>
  );

  const renderPetDetail = () => {
    if (!activePet) {
      return renderEmptyState();
    }

    const hungerPercent = getHungerPercent(activePet);
    const hungerColor = getHungerColor(activePet);

    return (
      <View className="detail-stack">
        <View className="detail-card spotlight-card">
          <View className="detail-header">
            <View className="detail-copy">
              <View className={`status-pill status-${activePet.status}`}>
                <Text className="status-pill-text">{getStatusText(activePet)}</Text>
              </View>
              <Text className="detail-name">{activePet.name}</Text>
              <Text className="detail-subtitle">
                Lv.{activePet.level} · {PET_SKIN_NAME[activePet.skin]}
              </Text>
            </View>
            <View
              className="detail-avatar-shell pet-sprite-action"
              onClick={() => {
                if (activePet.status !== "dead") {
                  playPetMotion("cuddle", 820);
                  playFeedback("cuddle", 1300);
                }
              }}
            >
              <PetSprite
                skin={activePet.skin}
                size="xl"
                status={activePet.status}
                mood={petMotion}
                selected
              />
              <View className={`pet-talk-bubble pet-talk-${feedbackKind}`}>
                <Text className="pet-talk-text">{activePetLine}</Text>
              </View>
              {feedBurst ? (
                <View key={feedBurst.id} className="feed-burst">
                  <Text className="feed-burst-food">{feedBurst.emoji}</Text>
                  <Text className="feed-burst-value">+{feedBurst.restoreHunger}</Text>
                  <Text className="feed-burst-cost">-{feedBurst.cost}分</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="detail-progress">
            <View className="progress-label-row">
              <Text className="minor-title">饱食度</Text>
              <Text className="progress-value">{Math.round(hungerPercent)} / 100</Text>
            </View>
            <View className="hunger-bar-container">
              <View
                className="hunger-bar-fill"
                style={{ width: `${hungerPercent}%`, backgroundColor: hungerColor }}
              />
            </View>
          </View>

          <View className="detail-grid">
            <View className="detail-grid-item">
              <Text className="detail-grid-label">创建时间</Text>
              <Text className="detail-grid-value">{formatDate(activePet.createdAt)}</Text>
            </View>
            <View className="detail-grid-item">
              <Text className="detail-grid-label">最后更新</Text>
              <Text className="detail-grid-value">{formatDate(activePet.lastUpdated)}</Text>
            </View>
            <View className="detail-grid-item">
              <Text className="detail-grid-label">共享积分</Text>
              <Text className="detail-grid-value">{storageData.balance}</Text>
            </View>
            <View className="detail-grid-item">
              <Text className="detail-grid-label">离开宠物</Text>
              <Text className="detail-grid-value">{deadCount}</Text>
            </View>
          </View>
        </View>

        {activePet.status === "dead" ? (
          <View className="detail-card memorial-card">
            <View className="memorial-avatar-shell">
              <PetSprite skin={activePet.skin} size="lg" status="dead" mood="idle" />
            </View>
            <Text className="memorial-title">{activePet.name} 已离开小院</Text>
            <Text className="memorial-desc">
              你仍然保留全部共享积分，可以继续领养新的宠物。
            </Text>
            {activePet.deathTime ? (
              <Text className="memorial-time">离开时间：{formatDate(activePet.deathTime)}</Text>
            ) : null}
          </View>
        ) : (
          <View className="detail-card shop-card">
            <View className="section-heading">
              <Text className="section-title">食物商店</Text>
              <Text className="section-desc">
                喂食消耗共享积分，所以多只宠物会一起竞争资源。
              </Text>
            </View>

            <View className="food-list">
              {FOOD_ITEMS.map((food) => (
                <View
                  key={food.id}
                  className={`food-item ${storageData.balance >= food.cost ? "food-available" : "food-unavailable"}`}
                  onClick={() => handleFeed(food.id)}
                >
                  <View className="food-icon-wrap">
                    <Text className="food-emoji">{food.emoji}</Text>
                  </View>
                  <View className="food-copy">
                    <Text className="food-name">{food.name}</Text>
                    <Text className="food-stats">恢复 {food.restoreHunger} 点饱食度</Text>
                  </View>
                  <Text className="food-cost">{food.cost} 分</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="pet-page">
      <View className="pet-shell">
        {renderHero()}
        {(showAdoptionPanel || pets.length === 0) && renderAdoptionPanel()}
        {pets.length === 0 ? renderEmptyState() : renderPetDetail()}
      </View>
    </View>
  );
}
