import type { PetSkin } from "../../pages/pet/types";
import type { PetSpriteMood } from "../../pages/pet/components/PetSprite/types";
import type { UserCloudSnapshot } from "../user-data/types";

export type CustomPetTaskStatus =
  | "uploaded"
  | "analyzing"
  | "generating_idle"
  | "generating_variants"
  | "validating"
  | "preview_ready"
  | "rerolling"
  | "adopted"
  | "cancelled"
  | "failed"
  | "deleting"
  | "deleted";

export interface CustomPetTask {
  jobId: string;
  status: CustomPetTaskStatus;
  step: string;
  candidateVersion: number;
  mappedSkin: PetSkin | null;
  speciesLabel: string | null;
  rerollUsed: boolean;
  errorCategory: string | null;
  errorCode: string | null;
  errorMessage?: string | null;
  retryAfter?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomPetMoodUrls = Partial<Record<PetSpriteMood, string>>;

export interface CustomPetApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CustomPetSnapshotResult {
  snapshot?: UserCloudSnapshot | null;
}
