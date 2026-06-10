import { Image, View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { resolveCachedPetSpriteUrl, resolvePetSpriteUrl } from "../../../../config/remoteAssets";
import { PET_SKIN_EMOJI } from "../../types";
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
  status = "alive",
  mood = "idle",
  size = "md",
  selected = false,
  className = "",
  staticImageSrc = "",
}: PetSpriteProps) {
  const safeMood = status === "dead" ? "idle" : status === "hungry" ? "hungry" : mood;
  const [imageSrc, setImageSrc] = useState(() => staticImageSrc || resolveCachedPetSpriteUrl(skin, safeMood));
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const shouldShowImage = Boolean(imageSrc) && !imageLoadFailed;

  useEffect(() => {
    let isCurrent = true;
    setImageLoadFailed(false);

    if (staticImageSrc) {
      setImageSrc(staticImageSrc);
      return () => {
        isCurrent = false;
      };
    }

    setImageSrc(resolveCachedPetSpriteUrl(skin, safeMood));

    void resolvePetSpriteUrl(skin, safeMood)
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
  }, [safeMood, skin, staticImageSrc]);
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
          onError={() => setImageLoadFailed(true)}
        />
      ) : (
        <View className="pet-sprite__fallback">{PET_SKIN_EMOJI[skin]}</View>
      )}
    </View>
  );
}
