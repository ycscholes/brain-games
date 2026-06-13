import { Image, View } from "@tarojs/components";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveCachedPetSpriteUrl, resolvePetSpriteUrl } from "../../../../config/remoteAssets";
import {
  resolveCachedCustomPetSpriteUrl,
  resolveCustomPetSpriteUrl,
} from "../../../../services/custom-pet/customPetService";
import type { PetSpriteProps } from "./types";
import "./index.scss";

const sizeClassMap: Record<NonNullable<PetSpriteProps["size"]>, string> = {
  xxs: "pet-sprite--xxs",
  xs: "pet-sprite--xs",
  sm: "pet-sprite--sm",
  md: "pet-sprite--md",
  lg: "pet-sprite--lg",
  xl: "pet-sprite--xl",
};

export default function PetSprite({
  skin,
  assetRef,
  status = "alive",
  mood = "idle",
  size = "md",
  selected = false,
  className = "",
}: PetSpriteProps) {
  const safeMood = status === "dead" ? "idle" : status === "hungry" ? "hungry" : mood;
  const customAssetId = assetRef?.kind === "custom" ? assetRef.customAssetId : null;
  const [imageSrc, setImageSrc] = useState(() =>
    customAssetId
      ? resolveCachedCustomPetSpriteUrl(customAssetId, safeMood)
      : resolveCachedPetSpriteUrl(skin, safeMood),
  );
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const hasRetriedRef = useRef(false);
  const shouldShowImage = Boolean(imageSrc) && !imageLoadFailed;

  useEffect(() => {
    let isCurrent = true;
    hasRetriedRef.current = false;
    setImageLoadFailed(false);
    setImageSrc(
      customAssetId
        ? resolveCachedCustomPetSpriteUrl(customAssetId, safeMood)
        : resolveCachedPetSpriteUrl(skin, safeMood),
    );

    const resolver = customAssetId
      ? resolveCustomPetSpriteUrl(customAssetId, safeMood)
      : resolvePetSpriteUrl(skin, safeMood);
    void resolver
      .then((url) => {
        if (isCurrent) {
          setImageSrc(url);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setImageLoadFailed(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [customAssetId, safeMood, skin]);

  const handleImageError = useCallback(() => {
    if (hasRetriedRef.current) {
      setImageLoadFailed(true);
      return;
    }

    hasRetriedRef.current = true;
    const resolver = customAssetId
      ? resolveCustomPetSpriteUrl(customAssetId, safeMood, { forceRefresh: true })
      : resolvePetSpriteUrl(skin, safeMood, { forceRefresh: true });
    void resolver
      .then((url) => {
        if (url) {
          setImageLoadFailed(false);
          setImageSrc(url);
          return;
        }

        setImageLoadFailed(true);
      })
      .catch(() => {
        setImageLoadFailed(true);
      });
  }, [customAssetId, safeMood, skin]);

  const classes = [
    "pet-sprite",
    sizeClassMap[size],
    `pet-sprite--${safeMood}`,
    status === "dead" ? "pet-sprite--dead" : "",
    selected ? "pet-sprite--selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className={classes}>
      <View className="pet-sprite__glow" />
      <View className="pet-sprite__shadow" />
      {shouldShowImage ? (
        <Image
          className="pet-sprite__image"
          src={imageSrc}
          mode="aspectFit"
          lazyLoad={false}
          onError={handleImageError}
        />
      ) : (
        <View className="pet-sprite__fallback" />
      )}
    </View>
  );
}
