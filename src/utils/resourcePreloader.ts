import Taro from "@tarojs/taro";
import farmSpeedStrip from "../assets/game-backgrounds/farm-speed-strip.jpg";
import shape01 from "../assets/shapes/shape_01.svg";
import shape02 from "../assets/shapes/shape_02.svg";
import shape03 from "../assets/shapes/shape_03.svg";
import shape04 from "../assets/shapes/shape_04.svg";
import shape05 from "../assets/shapes/shape_05.svg";
import shape06 from "../assets/shapes/shape_06.svg";
import shape07 from "../assets/shapes/shape_07.svg";
import shape08 from "../assets/shapes/shape_08.svg";
import shape09 from "../assets/shapes/shape_09.svg";
import shape10 from "../assets/shapes/shape_10.svg";
import { resolveAllRemoteAssetUrls } from "../config/remoteAssets";

export interface AssetPreloadProgress {
  loaded: number;
  total: number;
  failed: number;
}

export interface AssetPreloadOptions {
  timeoutMs?: number;
  onProgress?: (progress: AssetPreloadProgress) => void;
}

const LOCAL_GAME_IMAGES = [
  farmSpeedStrip,
  shape01,
  shape02,
  shape03,
  shape04,
  shape05,
  shape06,
  shape07,
  shape08,
  shape09,
  shape10,
];

function preloadImage(url: string) {
  if (!url) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    Taro.getImageInfo({
      src: url,
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch(() => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export async function preloadGameAssets(options?: AssetPreloadOptions): Promise<AssetPreloadProgress> {
  try {
    const timeoutMs = options?.timeoutMs ?? 3500;
    let resolvedRemoteCount = 0;
    let remoteTotal = 0;
    let imageTotal = LOCAL_GAME_IMAGES.length;
    let loadedImages = 0;
    let failedImages = 0;

    const report = () => {
      const total = remoteTotal + imageTotal;
      options?.onProgress?.({
        loaded: total > 0 ? Math.min(total, resolvedRemoteCount + loadedImages) : 0,
        total,
        failed: failedImages,
      });
    };

    report();

    const preloadPromise = (async () => {
      const remoteUrls = await resolveAllRemoteAssetUrls((progress) => {
        resolvedRemoteCount = progress.loaded;
        remoteTotal = progress.total;
        failedImages = progress.failed;
        report();
      });
      const urls = [...remoteUrls, ...LOCAL_GAME_IMAGES];
      imageTotal = urls.length;
      report();

      await Promise.all(
        urls.map(async (url) => {
          const loaded = await preloadImage(url);
          loadedImages += 1;
          if (!loaded) {
            failedImages += 1;
          }
          report();
        }),
      );
    })();

    await withTimeout(preloadPromise, timeoutMs);
    const total = remoteTotal + imageTotal;

    return {
      loaded: Math.min(total, resolvedRemoteCount + loadedImages),
      total,
      failed: failedImages,
    };
  } catch {
    const total = LOCAL_GAME_IMAGES.length;
    const progress = {
      loaded: total,
      total,
      failed: total,
    };
    options?.onProgress?.(progress);
    return progress;
  }
}
