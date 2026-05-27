import type { PetSkin } from "../pages/pet/types";
import type { PetSpriteMood } from "../pages/pet/components/PetSprite/types";
import { CLOUD_ENV_ID } from "./cloud";
import { ensureCloudReady } from "../services/user-data/cloud/cloudFunctionsClient";

const LOCAL_PET_SPRITE_URLS: Partial<Record<PetSkin, Partial<Record<PetSpriteMood, string>>>> = {
  cat: {
    idle: require("../assets/pet-yard-game/cat-idle.png"),
    feed: require("../assets/pet-yard-game/cat-feed.png"),
    cuddle: require("../assets/pet-yard-game/cat-cuddle.png"),
    hungry: require("../assets/pet-yard-game/cat-hungry.png"),
  },
  dog: {
    idle: require("../assets/pet-yard-game/dog-idle.png"),
    feed: require("../assets/pet-yard-game/dog-feed.png"),
    cuddle: require("../assets/pet-yard-game/dog-cuddle.png"),
    hungry: require("../assets/pet-yard-game/dog-hungry.png"),
  },
  rabbit: {
    idle: require("../assets/pet-yard-game/rabbit-idle.png"),
    feed: require("../assets/pet-yard-game/rabbit-feed.png"),
    cuddle: require("../assets/pet-yard-game/rabbit-cuddle.png"),
    hungry: require("../assets/pet-yard-game/rabbit-hungry.png"),
  },
  bear: {
    idle: require("../assets/pet-yard-game/bear-idle.png"),
    feed: require("../assets/pet-yard-game/bear-feed.png"),
    cuddle: require("../assets/pet-yard-game/bear-cuddle.png"),
    hungry: require("../assets/pet-yard-game/bear-hungry.png"),
  },
  panda: {
    idle: require("../assets/pet-yard-game/panda-idle.png"),
    feed: require("../assets/pet-yard-game/panda-feed.png"),
    cuddle: require("../assets/pet-yard-game/panda-cuddle.png"),
    hungry: require("../assets/pet-yard-game/panda-hungry.png"),
  },
};

const PET_SPRITE_PATHS: Record<PetSkin, Record<PetSpriteMood, string>> = {
  cat: {
    idle: "assets/pets/cat-idle.png",
    feed: "assets/pets/cat-feed.png",
    cuddle: "assets/pets/cat-cuddle.png",
    hungry: "assets/pets/cat-hungry.png",
  },
  dog: {
    idle: "assets/pets/dog-idle.png",
    feed: "assets/pets/dog-feed.png",
    cuddle: "assets/pets/dog-cuddle.png",
    hungry: "assets/pets/dog-hungry.png",
  },
  rabbit: {
    idle: "assets/pets/rabbit-idle.png",
    feed: "assets/pets/rabbit-feed.png",
    cuddle: "assets/pets/rabbit-cuddle.png",
    hungry: "assets/pets/rabbit-hungry.png",
  },
  bear: {
    idle: "assets/pets/bear-idle.png",
    feed: "assets/pets/bear-feed.png",
    cuddle: "assets/pets/bear-cuddle.png",
    hungry: "assets/pets/bear-hungry.png",
  },
  panda: {
    idle: "assets/pets/panda-idle.png",
    feed: "assets/pets/panda-feed.png",
    cuddle: "assets/pets/panda-cuddle.png",
    hungry: "assets/pets/panda-hungry.png",
  },
};

const FOOD_ICON_URLS: Partial<Record<string, string>> = {
  apple: require("../assets/pet-yard-game/food-apple.png"),
  fish: require("../assets/pet-yard-game/food-fish.png"),
  steak: require("../assets/pet-yard-game/food-steak.png"),
};

const tempFileUrlCache = new Map<string, string>();
const CLOUD_STORAGE_BUCKET =
  typeof __CLOUD_STORAGE_BUCKET__ !== "undefined"
    ? __CLOUD_STORAGE_BUCKET__
    : process.env.TARO_CLOUD_STORAGE_BUCKET || "";

function toCloudFileId(path: string): string {
  if (!CLOUD_ENV_ID || !CLOUD_STORAGE_BUCKET) {
    return "";
  }

  return `cloud://${CLOUD_ENV_ID}.${CLOUD_STORAGE_BUCKET}/${path}`;
}

async function resolveCloudFileUrl(path: string): Promise<string> {
  try {
    const fileID = toCloudFileId(path);
    if (!fileID) {
      return "";
    }

    const cachedUrl = tempFileUrlCache.get(fileID);
    if (cachedUrl) {
      return cachedUrl;
    }

    const cloud = await ensureCloudReady();
    if (!cloud?.getTempFileURL) {
      return "";
    }

    const result = await cloud.getTempFileURL({
      fileList: [fileID],
    });
    const tempFileURL = result.fileList?.[0]?.tempFileURL || "";

    if (tempFileURL) {
      tempFileUrlCache.set(fileID, tempFileURL);
    }

    return tempFileURL;
  } catch {
    return "";
  }
}

export async function resolvePetSpriteUrl(skin: PetSkin, mood: PetSpriteMood): Promise<string> {
  const localUrl = LOCAL_PET_SPRITE_URLS[skin]?.[mood];
  if (localUrl) {
    return localUrl;
  }

  return resolveCloudFileUrl(PET_SPRITE_PATHS[skin][mood]);
}

export function resolveFoodIconUrl(foodId: string): string {
  return FOOD_ICON_URLS[foodId] || "";
}
