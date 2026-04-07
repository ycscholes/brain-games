import { View } from "@tarojs/components";
import type { CSSProperties } from "react";
import { PET_SKIN_THEMES } from "./skinConfig";
import type { PetAvatarProps } from "./types";
import "./index.scss";

const sizeClassMap: Record<NonNullable<PetAvatarProps["size"]>, string> = {
  xs: "pet-avatar--xs",
  sm: "pet-avatar--sm",
  md: "pet-avatar--md",
  lg: "pet-avatar--lg",
  xl: "pet-avatar--xl",
};

export default function PetAvatar({
  skin,
  status = "alive",
  mood = "idle",
  size = "md",
  selected = false,
  className = "",
}: PetAvatarProps) {
  const theme = PET_SKIN_THEMES[skin];
  const style = {
    "--pet-avatar-primary": theme.primary,
    "--pet-avatar-secondary": theme.secondary,
    "--pet-avatar-accent": theme.accent,
    "--pet-avatar-belly": theme.belly,
    "--pet-avatar-blush": theme.blush,
    "--pet-avatar-ear-inner": theme.earInner,
    "--pet-avatar-spot": theme.spot,
  } as CSSProperties;

  const classes = [
    "pet-avatar",
    sizeClassMap[size],
    `pet-avatar--${skin}`,
    `pet-avatar--${mood}`,
    status === "dead" ? "pet-avatar--dead" : "",
    selected ? "pet-avatar--selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className={classes} style={style}>
      <View className="pet-avatar__glow" />
      <View className="pet-avatar__shadow" />
      <View className="pet-avatar__tail" />
      <View className="pet-avatar__body">
        <View className="pet-avatar__belly" />
      </View>
      <View className="pet-avatar__head">
        <View className="pet-avatar__ear pet-avatar__ear--left" />
        <View className="pet-avatar__ear pet-avatar__ear--right" />
        <View className="pet-avatar__face">
          <View className="pet-avatar__patch pet-avatar__patch--left" />
          <View className="pet-avatar__patch pet-avatar__patch--right" />
          <View className="pet-avatar__eye pet-avatar__eye--left" />
          <View className="pet-avatar__eye pet-avatar__eye--right" />
          <View className="pet-avatar__nose" />
          <View className="pet-avatar__mouth" />
          <View className="pet-avatar__blush pet-avatar__blush--left" />
          <View className="pet-avatar__blush pet-avatar__blush--right" />
        </View>
      </View>
      <View className="pet-avatar__paws">
        <View className="pet-avatar__paw pet-avatar__paw--left" />
        <View className="pet-avatar__paw pet-avatar__paw--right" />
      </View>
      <View className="pet-avatar__sparkle pet-avatar__sparkle--one" />
      <View className="pet-avatar__sparkle pet-avatar__sparkle--two" />
      <View className="pet-avatar__sparkle pet-avatar__sparkle--three" />
    </View>
  );
}
