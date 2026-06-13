const CUSTOM_PET_PRICE = 300;
const MAX_REROLLS = 1;
const MAX_STEP_ATTEMPTS = 3;

const CUSTOM_PET_MOODS = ["idle", "feed", "cuddle", "hungry"];
const PET_SKINS = ["cat", "dog", "rabbit", "bear", "panda", "gecko", "turtle"];

const ACTIVE_STATUSES = new Set([
  "uploaded",
  "analyzing",
  "generating_idle",
  "generating_variants",
  "validating",
  "rerolling",
  "deleting",
]);

const TRANSITIONS = {
  uploaded: new Set(["analyzing", "failed", "cancelled"]),
  analyzing: new Set(["generating_idle", "failed", "cancelled"]),
  generating_idle: new Set(["generating_variants", "failed", "cancelled"]),
  generating_variants: new Set(["validating", "failed", "cancelled"]),
  validating: new Set(["preview_ready", "failed", "cancelled"]),
  preview_ready: new Set(["rerolling", "adopted", "cancelled", "deleting"]),
  rerolling: new Set(["generating_idle", "preview_ready", "failed", "cancelled"]),
  adopted: new Set(["deleting"]),
  cancelled: new Set(["deleting"]),
  failed: new Set(["uploaded", "deleting"]),
  deleting: new Set(["deleted"]),
  deleted: new Set(),
};

const RETRYABLE_ERROR_CODES = new Set([
  "RequestLimitExceeded",
  "FailedOperation.RequestTimeout",
  "FailedOperation.InnerError",
  "FailedOperation.RpcFail",
  "FailedOperation.ServerError",
  "FailedOperation.ImageDownloadError",
]);

const MODERATION_ERROR_CODES = new Set([
  "OperationDenied.ImageIllegalDetected",
  "OperationDenied.TextIllegalDetected",
  "FailedOperation.ModerationFailed",
  "FailedOperation.GenerateImageFailed",
]);

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].has(to));
}

function isActiveStatus(status) {
  return ACTIVE_STATUSES.has(status);
}

function getNextWorkerStep(status) {
  const next = {
    uploaded: "analyzing",
    analyzing: "generating_idle",
    generating_idle: "generating_variants",
    generating_variants: "validating",
    validating: "preview_ready",
    rerolling: "generating_idle",
  };
  return next[status] || null;
}

function normalizeMappedSkin(value) {
  return PET_SKINS.includes(value) ? value : "cat";
}

function getOwnerRoot(ownerId, jobId) {
  return `users/${ownerId}/custom-pets/${jobId}`;
}

function getSourcePath(ownerId, jobId, extension = "jpg") {
  return `${getOwnerRoot(ownerId, jobId)}/source/source.${extension}`;
}

function getCandidateMoodPath(ownerId, jobId, version, mood) {
  if (!CUSTOM_PET_MOODS.includes(mood)) {
    throw new Error(`invalid custom pet mood: ${mood}`);
  }
  return `${getOwnerRoot(ownerId, jobId)}/candidates/${version}/${mood}.png`;
}

function classifyProviderError(error) {
  const code = String(error && (error.code || error.Code || error.name || ""));
  if (MODERATION_ERROR_CODES.has(code)) {
    return {
      category: "moderation",
      retryable: false,
      code,
    };
  }
  if (RETRYABLE_ERROR_CODES.has(code)) {
    return {
      category: "temporary",
      retryable: true,
      code,
    };
  }
  return {
    category: "system",
    retryable: false,
    code: code || "UnknownError",
  };
}

function sanitizeTask(task) {
  if (!task) {
    return null;
  }
  return {
    jobId: task.jobId,
    status: task.status,
    step: task.step || task.status,
    candidateVersion: task.candidateVersion || 1,
    mappedSkin: task.mappedSkin || null,
    speciesLabel: task.speciesLabel || null,
    rerollUsed: Boolean(task.rerollUsed),
    errorCategory: task.errorCategory || null,
    errorCode: task.errorCode || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  CUSTOM_PET_MOODS,
  CUSTOM_PET_PRICE,
  MAX_REROLLS,
  MAX_STEP_ATTEMPTS,
  PET_SKINS,
  canTransition,
  classifyProviderError,
  getCandidateMoodPath,
  getNextWorkerStep,
  getOwnerRoot,
  getSourcePath,
  isActiveStatus,
  normalizeMappedSkin,
  sanitizeTask,
};
