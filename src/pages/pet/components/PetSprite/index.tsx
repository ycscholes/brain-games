import { Image, View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { resolvePetSpriteUrl } from "../../../../config/remoteAssets";
import { PET_SKIN_EMOJI } from "../../types";
import type { PetSpriteMood, PetSpriteProps } from "./types";
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
}: PetSpriteProps) {
  const [imageSrc, setImageSrc] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const safeMood = status === "dead" ? "idle" : mood;
  const shouldShowImage = Boolean(imageSrc) && !imageLoadFailed;

  useEffect(() => {
    let isCurrent = true;
    setImageLoadFailed(false);
    setImageSrc("");

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
  }, [safeMood, skin]);
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
          mode="scaleToFill"
          lazyLoad={false}
          onError={() => setImageLoadFailed(true)}
        />
      ) : (
        <View className="pet-sprite__fallback">{PET_SKIN_EMOJI[skin]}</View>
      )}
    </View>
  );
}
