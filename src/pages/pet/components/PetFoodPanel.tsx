import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import { resolveCachedFoodIconUrl, resolveFoodIconUrl } from "../../../config/remoteAssets";
import type { FoodItem, PetData } from "../../../domain/pet/types";

export interface PetFoodPanelProps {
  pet: PetData | null;
  foods: FoodItem[];
  balance: number;
  onFeed: (food: FoodItem) => void;
}

export function FoodIcon({ food }: { food: FoodItem }) {
  const [iconUrl, setIconUrl] = useState(() => resolveCachedFoodIconUrl(food.imageId));
  const [imageFailed, setImageFailed] = useState(false);
  const hasRetriedRef = useRef(false);

  useEffect(() => {
    let isCurrent = true;
    hasRetriedRef.current = false;
    setImageFailed(false);
    setIconUrl(resolveCachedFoodIconUrl(food.imageId));

    void resolveFoodIconUrl(food.imageId)
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
  }, [food.imageId]);

  const handleImageError = useCallback(() => {
    if (hasRetriedRef.current) {
      setImageFailed(true);
      return;
    }

    hasRetriedRef.current = true;

    void resolveFoodIconUrl(food.imageId, { forceRefresh: true })
      .then((url) => {
        if (url) {
          setImageFailed(false);
          setIconUrl(url);
          return;
        }

        setImageFailed(true);
      })
      .catch(() => {
        setImageFailed(true);
      });
  }, [food.imageId]);

  if (iconUrl && !imageFailed) {
    return (
      <Image className="food-image" src={iconUrl} mode="aspectFit" onError={handleImageError} />
    );
  }

  return <View className="food-image-placeholder" />;
}

export default function PetFoodPanel({ pet, foods, balance, onFeed }: PetFoodPanelProps) {
  if (!pet || pet.status === "dead") {
    return null;
  }

  return (
    <View className="food-dock">
      {foods.map((food) => (
        <View
          key={food.id}
          className={`food-button ${balance >= food.cost ? "food-button-ready" : "food-button-disabled"}`}
          onClick={() => onFeed(food)}
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
  );
}
