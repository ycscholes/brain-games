import geckoAdoptionAvatar from "../../assets/pets/adoption-gecko.png";
import turtleAdoptionAvatar from "../../assets/pets/adoption-turtle.png";
import type { PetSkin } from "./types";

export const PET_ADOPTION_AVATAR_SRC: Partial<Record<PetSkin, string>> = {
  gecko: geckoAdoptionAvatar,
  turtle: turtleAdoptionAvatar,
};
