const CUSTOM_PET_PRICE = 300;
const MAX_REROLLS = 1;
const MAX_STEP_ATTEMPTS = 3;
const MAX_QUOTA_RETRY_ATTEMPTS = 48;
const QUOTA_RETRY_DELAY_MS = 30 * 60 * 1000;

const CUSTOM_PET_MOODS = ["idle", "feed", "cuddle", "hungry"];
const PET_SKINS = ["cat", "dog", "rabbit", "bear", "panda", "gecko", "turtle"];
const DEFAULT_CUSTOM_PET_TRAITS = {
  primaryColor: "保留原图主色",
  secondaryColor: "保留原图辅助色",
  markings: "保留原图明显花纹",
  bodyShape: "保留原图体型",
  accessories: "保留原图配饰",
};

const ACTIVE_STATUSES = new Set([
  "uploaded",
  "analyzing",
  "generating_idle",
  "generating_variants",
  "validating",
  "rerolling",
  "deleting",
]);

const WORKER_STATUSES = new Set([
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
  "408",
  "409",
  "425",
  "500",
  "502",
  "503",
  "504",
  "RequestLimitExceeded",
  "FailedOperation.RequestTimeout",
  "FailedOperation.InnerError",
  "FailedOperation.RpcFail",
  "FailedOperation.ServerError",
  "FailedOperation.ImageDownloadError",
]);

const QUOTA_ERROR_CODES = new Set([
  "429",
  "TooManyRequests",
  "TooManyRequestsException",
  "ResourceExhausted",
  "ResourceExhaustedError",
  "RequestLimitExceeded",
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

function stripDatabaseIds(value) {
  if (Array.isArray(value)) {
    return value.map(stripDatabaseIds);
  }
  if (!value || typeof value !== "object" || Buffer.isBuffer(value)) {
    return value;
  }
  return Object.keys(value).reduce((acc, key) => {
    if (key !== "_id") {
      acc[key] = stripDatabaseIds(value[key]);
    }
    return acc;
  }, {});
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

function getProviderErrorCode(error) {
  const rawStatus = error && (error.status || error.statusCode || (error.response && error.response.status));
  if (rawStatus) {
    return String(rawStatus);
  }
  const rawCode = error && (error.code || error.Code);
  if (rawCode) {
    return String(rawCode);
  }
  const message = String(error && error.message ? error.message : "");
  const statusMatch = message.match(/\bstatus code\s+(\d{3})\b/i);
  if (statusMatch) {
    return statusMatch[1];
  }
  const name = error && error.name;
  return name && name !== "Error" ? String(name) : "";
}

function classifyProviderError(error) {
  const code = getProviderErrorCode(error);
  if (MODERATION_ERROR_CODES.has(code)) {
    return {
      category: "moderation",
      retryable: false,
      code,
    };
  }
  if (QUOTA_ERROR_CODES.has(code)) {
    return {
      category: "quota",
      retryable: true,
      retryLimit: MAX_QUOTA_RETRY_ATTEMPTS,
      retryDelayMs: QUOTA_RETRY_DELAY_MS,
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
    errorMessage: task.errorMessage || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  WORKER_STATUSES,
  CUSTOM_PET_MOODS,
  CUSTOM_PET_PRICE,
  DEFAULT_CUSTOM_PET_TRAITS,
  MAX_QUOTA_RETRY_ATTEMPTS,
  MAX_REROLLS,
  MAX_STEP_ATTEMPTS,
  QUOTA_RETRY_DELAY_MS,
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
  stripDatabaseIds,
};
