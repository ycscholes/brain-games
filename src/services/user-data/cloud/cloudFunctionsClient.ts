import { CLOUD_ENV_ID } from "../../../config/cloud";
import type { LoginResult, UserSnapshotResult } from "../types";

const CLOUD_FUNCTION_TIMEOUT_MS = 5000;

let cloudInitialized = false;

function getCloudApi(): MiniProgramCloudFunctionApi | null {
  if (typeof wx === "undefined" || !wx.cloud) {
    return null;
  }

  return wx.cloud;
}

export async function ensureCloudReady() {
  const cloud = getCloudApi();
  if (!cloud || !CLOUD_ENV_ID) {
    return null;
  }

  if (!cloudInitialized) {
    cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true,
    });
    cloudInitialized = true;
  }

  return cloud;
}

async function withCloudFunctionTimeout<T>(
  promise: Promise<T>,
  functionName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${functionName} cloud function timeout`));
    }, CLOUD_FUNCTION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function callLoginFunction() {
  const cloud = await ensureCloudReady();
  if (!cloud) {
    return null;
  }

  const result = await withCloudFunctionTimeout(
    cloud.callFunction<LoginResult>({
      name: "login",
    }),
    "login",
  );
  return result.result ?? null;
}

export async function callGetUserDataFunction() {
  const cloud = await ensureCloudReady();
  if (!cloud) {
    return null;
  }

  const result = await withCloudFunctionTimeout(
    cloud.callFunction<UserSnapshotResult>({
      name: "getUserData",
    }),
    "getUserData",
  );
  return result.result ?? null;
}

export async function callSyncUserDataFunction(data: Record<string, unknown>) {
  const cloud = await ensureCloudReady();
  if (!cloud) {
    throw new Error("cloud api unavailable");
  }

  return withCloudFunctionTimeout(
    cloud.callFunction<{ updatedAt?: string }>({
      name: "syncUserData",
      data,
    }),
    "syncUserData",
  );
}
