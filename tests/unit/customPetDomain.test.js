const {
  CUSTOM_PET_PRICE,
  DEFAULT_CUSTOM_PET_TRAITS,
  MAX_QUOTA_RETRY_ATTEMPTS,
  MAX_REROLLS,
  canTransition,
  classifyProviderError,
  getCandidateMoodPath,
  getNextWorkerStep,
  getSourcePath,
  isActiveStatus,
  normalizeMappedSkin,
  QUOTA_RETRY_DELAY_MS,
  sanitizeTask,
  stripDatabaseIds,
} = require("../../cloudfunctions/shared/customPetDomain");

describe("custom pet domain", () => {
  test("defines the approved price and reroll limit", () => {
    expect(CUSTOM_PET_PRICE).toBe(300);
    expect(MAX_REROLLS).toBe(1);
  });

  test("defines object-shaped default custom pet traits", () => {
    expect(DEFAULT_CUSTOM_PET_TRAITS).toMatchObject({
      primaryColor: expect.any(String),
      secondaryColor: expect.any(String),
      markings: expect.any(String),
      bodyShape: expect.any(String),
      accessories: expect.any(String),
    });
  });

  test("allows only legal task transitions", () => {
    expect(canTransition("uploaded", "analyzing")).toBe(true);
    expect(canTransition("preview_ready", "adopted")).toBe(true);
    expect(canTransition("failed", "adopted")).toBe(false);
    expect(canTransition("deleted", "uploaded")).toBe(false);
  });

  test("maps worker states to the next recoverable step", () => {
    expect(getNextWorkerStep("generating_idle")).toBe("generating_variants");
    expect(getNextWorkerStep("validating")).toBe("preview_ready");
    expect(getNextWorkerStep("preview_ready")).toBeNull();
  });

  test("distinguishes active and terminal statuses", () => {
    expect(isActiveStatus("analyzing")).toBe(true);
    expect(isActiveStatus("rerolling")).toBe(true);
    expect(isActiveStatus("preview_ready")).toBe(false);
  });

  test("builds deterministic private storage paths", () => {
    expect(getSourcePath("user-1", "job-1", "png")).toBe(
      "users/user-1/custom-pets/job-1/source/source.png",
    );
    expect(getCandidateMoodPath("user-1", "job-1", 2, "feed")).toBe(
      "users/user-1/custom-pets/job-1/candidates/2/feed.png",
    );
  });

  test("normalizes unsupported template mappings", () => {
    expect(normalizeMappedSkin("turtle")).toBe("turtle");
    expect(normalizeMappedSkin("hamster")).toBe("cat");
  });

  test("classifies provider moderation and temporary failures", () => {
    expect(classifyProviderError({ code: "OperationDenied.ImageIllegalDetected" })).toMatchObject({
      category: "moderation",
      retryable: false,
    });
    expect(classifyProviderError({ code: "FailedOperation.RequestTimeout" })).toMatchObject({
      category: "temporary",
      retryable: true,
    });
    expect(classifyProviderError({ code: "RequestLimitExceeded" })).toMatchObject({
      category: "quota",
      retryable: true,
      retryLimit: MAX_QUOTA_RETRY_ATTEMPTS,
    });
    expect(classifyProviderError({ code: "429" })).toMatchObject({
      category: "quota",
      retryable: true,
      retryLimit: MAX_QUOTA_RETRY_ATTEMPTS,
      retryDelayMs: QUOTA_RETRY_DELAY_MS,
    });
    expect(classifyProviderError(new Error("Request failed with status code 429"))).toMatchObject({
      category: "quota",
      retryable: true,
      code: "429",
    });
    expect(classifyProviderError({
      code: "ERR_BAD_REQUEST",
      response: { status: 429 },
    })).toMatchObject({
      category: "quota",
      retryable: true,
      code: "429",
    });
  });

  test("does not expose owner identifiers or private files to clients", () => {
    expect(sanitizeTask({
      jobId: "job-1",
      ownerId: "secret-openid",
      sourceFileId: "cloud://private-source",
      status: "preview_ready",
      candidateVersion: 1,
      mappedSkin: "dog",
      rerollUsed: false,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:01:00.000Z",
    })).toEqual({
      jobId: "job-1",
      status: "preview_ready",
      step: "preview_ready",
      candidateVersion: 1,
      mappedSkin: "dog",
      speciesLabel: null,
      rerollUsed: false,
      errorMessage: null,
      errorCategory: null,
      errorCode: null,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:01:00.000Z",
    });
  });

  test("strips CloudBase document ids recursively without changing business ids", () => {
    expect(stripDatabaseIds({
      _id: "doc-id",
      id: "business-id",
      petData: {
        _id: "nested-doc-id",
        pets: [
          { _id: "pet-doc-id", id: "pet-id", name: "Cici" },
        ],
      },
    })).toEqual({
      id: "business-id",
      petData: {
        pets: [
          { id: "pet-id", name: "Cici" },
        ],
      },
    });
  });
});
