import type { PetSkin } from "../pages/pet/types";
import type { PetSpriteMood } from "../pages/pet/components/PetSprite/types";
import { CLOUD_ENV_ID } from "./cloud";
import { ensureCloudReady } from "../services/user-data/cloud/cloudFunctionsClient";

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
  return resolveCloudFileUrl(PET_SPRITE_PATHS[skin][mood]);
}
