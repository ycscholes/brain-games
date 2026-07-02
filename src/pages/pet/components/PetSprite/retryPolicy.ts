export const PET_IMAGE_RETRY_DELAYS_MS = [300, 1000, 2500, 5000] as const;

export function getPetImageRetryDelayMs(failedAttempts: number): number | null {
  return PET_IMAGE_RETRY_DELAYS_MS[failedAttempts] ?? null;
}
