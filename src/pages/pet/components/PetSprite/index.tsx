import { Image, View } from "@tarojs/components";
import type { PetSkin } from "../../types";
import type { PetSpriteMood, PetSpriteProps } from "./types";
import catIdle from "../../../../assets/pets/cat-idle.png";
import catFeed from "../../../../assets/pets/cat-feed.png";
import catCuddle from "../../../../assets/pets/cat-cuddle.png";
import dogIdle from "../../../../assets/pets/dog-idle.png";
import dogFeed from "../../../../assets/pets/dog-feed.png";
import dogCuddle from "../../../../assets/pets/dog-cuddle.png";
import rabbitIdle from "../../../../assets/pets/rabbit-idle.png";
import rabbitFeed from "../../../../assets/pets/rabbit-feed.png";
import rabbitCuddle from "../../../../assets/pets/rabbit-cuddle.png";
import bearIdle from "../../../../assets/pets/bear-idle.png";
import bearFeed from "../../../../assets/pets/bear-feed.png";
import bearCuddle from "../../../../assets/pets/bear-cuddle.png";
import pandaIdle from "../../../../assets/pets/panda-idle.png";
import pandaFeed from "../../../../assets/pets/panda-feed.png";
import pandaCuddle from "../../../../assets/pets/panda-cuddle.png";
import "./index.scss";

const sizeClassMap: Record<NonNullable<PetSpriteProps["size"]>, string> = {
  xs: "pet-sprite--xs",
  sm: "pet-sprite--sm",
  md: "pet-sprite--md",
  lg: "pet-sprite--lg",
  xl: "pet-sprite--xl",
};

const PET_SPRITES: Record<PetSkin, Record<PetSpriteMood, string>> = {
  cat: {
    idle: catIdle,
    feed: catFeed,
    cuddle: catCuddle,
  },
  dog: {
    idle: dogIdle,
    feed: dogFeed,
    cuddle: dogCuddle,
  },
  rabbit: {
    idle: rabbitIdle,
    feed: rabbitFeed,
    cuddle: rabbitCuddle,
  },
  bear: {
    idle: bearIdle,
    feed: bearFeed,
    cuddle: bearCuddle,
  },
  panda: {
    idle: pandaIdle,
    feed: pandaFeed,
    cuddle: pandaCuddle,
  },
};

export default function PetSprite({
  skin,
  status = "alive",
  mood = "idle",
  size = "md",
  selected = false,
  className = "",
}: PetSpriteProps) {
  const safeMood = status === "dead" ? "idle" : mood;
  const imageSrc = PET_SPRITES[skin][safeMood];
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
      <Image className="pet-sprite__image" src={imageSrc} mode="aspectFit" />
    </View>
  );
}
