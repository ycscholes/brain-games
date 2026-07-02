import { Image, View } from "@tarojs/components";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveCachedPetSpriteUrl, resolvePetSpriteUrl } from "../../../../config/remoteAssets";
import {
  resolveCachedCustomPetSpriteUrl,
  resolveCustomPetSpriteUrl,
} from "../../../../services/custom-pet/customPetService";
import { getPetImageRetryDelayMs } from "./retryPolicy";
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
  const [imageRetryToken, setImageRetryToken] = useState(0);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShowImage = Boolean(imageSrc) && !imageLoadFailed;
  const spriteKey = customAssetId ? `custom:${customAssetId}` : `standard:${skin}`;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleImageRetry = useCallback(() => {
    const retryDelay = getPetImageRetryDelayMs(retryAttemptRef.current);
    if (retryDelay === null) {
      setImageLoadFailed(true);
      return;
    }

    retryAttemptRef.current += 1;
    clearRetryTimer();
    setImageLoadFailed(false);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setImageRetryToken((value) => value + 1);
    }, retryDelay);
  }, [clearRetryTimer]);

  useEffect(() => () => clearRetryTimer(), [clearRetryTimer]);

  useEffect(() => {
    clearRetryTimer();
    retryAttemptRef.current = 0;
    setImageLoadFailed(false);
    setImageRetryToken(0);
    setImageSrc(
      customAssetId
        ? resolveCachedCustomPetSpriteUrl(customAssetId, safeMood)
        : resolveCachedPetSpriteUrl(skin, safeMood),
    );
  }, [clearRetryTimer, customAssetId, safeMood, skin, spriteKey]);

  useEffect(() => {
    let isCurrent = true;
    setImageLoadFailed(false);
    setImageSrc(
      customAssetId
        ? resolveCachedCustomPetSpriteUrl(customAssetId, safeMood)
        : resolveCachedPetSpriteUrl(skin, safeMood),
    );

    const resolver = customAssetId
      ? resolveCustomPetSpriteUrl(customAssetId, safeMood, {
          forceRefresh: imageRetryToken > 0,
        })
      : resolvePetSpriteUrl(skin, safeMood, {
          forceRefresh: imageRetryToken > 0,
        });
    void resolver
      .then((url) => {
        if (isCurrent) {
          if (!url) {
            scheduleImageRetry();
            return;
          }

          setImageSrc(url);
        }
      })
      .catch(() => {
        if (isCurrent) {
          scheduleImageRetry();
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [customAssetId, imageRetryToken, safeMood, scheduleImageRetry, skin]);

  const handleImageError = useCallback(() => {
    scheduleImageRetry();
  }, [scheduleImageRetry]);

  const handleImageLoad = useCallback(() => {
    clearRetryTimer();
    retryAttemptRef.current = 0;
    setImageLoadFailed(false);
  }, [clearRetryTimer]);

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
          key={`${spriteKey}:${safeMood}:${imageRetryToken}:${imageSrc}`}
          className="pet-sprite__image"
          src={imageSrc}
          mode="aspectFit"
          lazyLoad={false}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      ) : (
        <View className="pet-sprite__fallback" />
      )}
    </View>
  );
}
