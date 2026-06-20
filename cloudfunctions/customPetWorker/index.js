const cloud = require("wx-server-sdk");
const {
  CUSTOM_PET_MOODS,
  MAX_STEP_ATTEMPTS,
  WORKER_STATUSES,
  classifyProviderError,
  getCandidateMoodPath,
  stripDatabaseIds,
} = require("./shared/customPetDomain");
const {
  analyzeSource,
  generateMood,
  generateMoodSheet,
  normalizeSprite,
  splitMoodSheet,
  validateRuntimeDependencies,
} = require("./shared/customPetGenerator");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const JOB_COLLECTION = "custom_pet_jobs";
const ENTITLEMENT_COLLECTION = "custom_pet_entitlements";
const SNAPSHOT_COLLECTION = "xiaoyuyuan_user_snapshots";
const LOCK_TTL_MS = 12 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function getErrorSummary(error) {
  const message = error && error.message ? String(error.message) : String(error || "unknown error");
  return message.slice(0, 240);
}

async function getTask(jobId) {
  const result = await db.collection(JOB_COLLECTION).doc(jobId).get().catch(() => null);
  return result && result.data ? result.data : null;
}

async function download(fileID) {
  const result = await cloud.downloadFile({ fileID });
  return result.fileContent;
}

async function upload(path, buffer) {
  const result = await cloud.uploadFile({
    cloudPath: path,
    fileContent: buffer,
  });
  return result.fileID;
}

async function claimTask(jobId) {
  const task = await getTask(jobId);
  if (!task || !WORKER_STATUSES.has(task.status)) {
    return null;
  }
  const now = Date.now();
  if (task.workerLockUntil && new Date(task.workerLockUntil).getTime() > now) {
    return null;
  }
  const token = `${now}_${Math.random().toString(36).slice(2, 10)}`;
  await db.collection(JOB_COLLECTION).doc(jobId).update({
    data: {
      workerLockToken: token,
      workerLockUntil: new Date(now + LOCK_TTL_MS).toISOString(),
      updatedAt: nowIso(),
    },
  });
  const claimed = await getTask(jobId);
  return claimed && claimed.workerLockToken === token ? claimed : null;
}

async function updateTask(jobId, data) {
  const task = await getTask(jobId);
  if (!task) {
    throw new Error("custom pet task not found");
  }
  await db.collection(JOB_COLLECTION).doc(jobId).set({
    data: stripDatabaseIds({
      ...task,
      ...data,
      updatedAt: nowIso(),
    }),
  });
}

async function processAnalyzing(task) {
  await updateTask(task.jobId, { status: "analyzing", step: "analyzing" });
  const sourceBuffer = await download(task.sourceFileId);
  const analysis = await analyzeSource({ sourceBuffer });
  await updateTask(task.jobId, {
    ...analysis,
    status: "generating_idle",
    step: "generating_idle",
  });
}

async function processIdle(task) {
  const sourceBuffer = await download(task.sourceFileId);
  const generatedSheet = await generateMoodSheet({
    referenceBuffer: sourceBuffer,
    traits: task.traits,
    speciesLabel: task.speciesLabel,
  });
  let normalizedSprites = null;
  try {
    const sheetSprites = await splitMoodSheet({ inputBuffer: generatedSheet });
    normalizedSprites = {};
    for (const mood of CUSTOM_PET_MOODS) {
      normalizedSprites[mood] = await normalizeSprite({ inputBuffer: sheetSprites[mood] });
    }
  } catch (error) {
    console.warn("[customPetWorker] mood sheet post-processing failed; falling back to per-mood generation", {
      jobId: task.jobId,
      message: getErrorSummary(error),
    });
    await processIdleWithSeparateGeneration(task, sourceBuffer);
    return;
  }

  const fileIds = {};
  for (const mood of CUSTOM_PET_MOODS) {
    fileIds[mood] = await upload(
      getCandidateMoodPath(task.ownerId, task.jobId, task.candidateVersion || 1, mood),
      normalizedSprites[mood],
    );
    await updateTask(task.jobId, { candidateSpriteFileIds: fileIds });
  }
  await updateTask(task.jobId, {
    status: "validating",
    step: "validating",
    candidateSpriteFileIds: fileIds,
  });
}

async function processIdleWithSeparateGeneration(task, sourceBuffer) {
  const generated = await generateMood({
    referenceBuffer: sourceBuffer,
    mood: "idle",
    traits: task.traits,
    speciesLabel: task.speciesLabel,
  });
  const normalized = await normalizeSprite({ inputBuffer: generated });
  const fileID = await upload(
    getCandidateMoodPath(task.ownerId, task.jobId, task.candidateVersion || 1, "idle"),
    normalized,
  );
  await updateTask(task.jobId, {
    status: "generating_variants",
    step: "generating_variants",
    candidateSpriteFileIds: {
      idle: fileID,
    },
  });
}

async function processVariants(task) {
  const fileIds = { ...(task.candidateSpriteFileIds || {}) };
  const idleBuffer = await download(fileIds.idle);
  for (const mood of CUSTOM_PET_MOODS.filter((item) => item !== "idle")) {
    if (fileIds[mood]) {
      continue;
    }
    const generated = await generateMood({
      referenceBuffer: idleBuffer,
      mood,
      traits: task.traits,
      speciesLabel: task.speciesLabel,
    });
    const normalized = await normalizeSprite({ inputBuffer: generated });
    fileIds[mood] = await upload(
      getCandidateMoodPath(task.ownerId, task.jobId, task.candidateVersion || 1, mood),
      normalized,
    );
    await updateTask(task.jobId, { candidateSpriteFileIds: fileIds });
  }
  await updateTask(task.jobId, {
    status: "validating",
    step: "validating",
    candidateSpriteFileIds: fileIds,
  });
}

async function processValidation(task) {
  const complete = CUSTOM_PET_MOODS.every((mood) => task.candidateSpriteFileIds?.[mood]);
  if (!complete) {
    throw new Error("custom pet images incomplete");
  }
  const updatedAt = nowIso();
  await db.runTransaction(async (transaction) => {
    const entitlementResult = await transaction
      .collection(ENTITLEMENT_COLLECTION)
      .doc(task.ownerId)
      .get()
      .catch(() => null);
    const entitlement = stripDatabaseIds(entitlementResult && entitlementResult.data ? entitlementResult.data : {});
    await transaction.collection(ENTITLEMENT_COLLECTION).doc(task.ownerId).set({
      data: {
        ...entitlement,
        ownerId: task.ownerId,
        jobId: task.jobId,
        activeJobId: task.jobId,
        customPetGenerationUsed: true,
        usedAt: entitlement.usedAt || updatedAt,
        updatedAt,
      },
    });
    await transaction.collection(JOB_COLLECTION).doc(task.jobId).update({
      data: {
        status: "preview_ready",
        step: "preview_ready",
        errorCode: null,
        errorCategory: null,
        workerLockToken: null,
        workerLockUntil: null,
        updatedAt,
      },
    });
  });
}

async function processDeletion(task) {
  const assetPath = ["users", task.ownerId, "custom-pets", task.jobId].join("/");
  const root = `cloud://${process.env.TCB_ENV || ""}/${assetPath}`;
  const files = [
    task.sourceFileId,
    ...Object.values(task.candidateSpriteFileIds || {}),
    ...Object.values(task.previousCandidateSpriteFileIds || {}),
  ].filter(Boolean);
  if (files.length > 0) {
    await cloud.deleteFile({ fileList: [...new Set(files)] }).catch(() => null);
  }
  await db.collection("custom_pet_assets").doc(task.jobId).remove().catch(() => null);
  await updateTask(task.jobId, {
    status: "deleted",
    step: "deleted",
    sourceFileId: null,
    candidateSpriteFileIds: {},
    previousCandidateSpriteFileIds: {},
    traits: null,
    workerLockToken: null,
    workerLockUntil: null,
    deletedRoot: root,
  });
}

async function releaseAfterFailure(task, error) {
  const classified = classifyProviderError(error);
  const errorMessage = getErrorSummary(error);
  console.error("[customPetWorker] step failed", {
    jobId: task.jobId,
    status: task.status,
    step: task.step,
    code: classified.code,
    category: classified.category,
    message: errorMessage,
  });
  const key = task.step || task.status;
  const attempts = Number(task.attemptsByStep?.[key] || 0) + 1;
  const retryLimit = Number(classified.retryLimit || MAX_STEP_ATTEMPTS);
  const retryable = classified.retryable && attempts < retryLimit;
  if (
    !retryable &&
    task.rerollUsed &&
    task.previousCandidateSpriteFileIds &&
    CUSTOM_PET_MOODS.every((mood) => task.previousCandidateSpriteFileIds[mood])
  ) {
    await updateTask(task.jobId, {
      status: "preview_ready",
      step: "preview_ready",
      candidateVersion: task.previousCandidateVersion || 1,
      candidateSpriteFileIds: task.previousCandidateSpriteFileIds,
      errorCode: classified.code,
      errorCategory: classified.category,
      errorMessage,
      workerLockToken: null,
      workerLockUntil: null,
    });
    return;
  }
  const failureData = {
    status: retryable ? task.status : "failed",
    step: retryable ? task.step : "failed",
    attemptsByStep: {
      ...(task.attemptsByStep || {}),
      [key]: attempts,
    },
    errorCode: classified.code,
    errorCategory: classified.category,
    errorMessage,
    retryAfter: retryable
      ? new Date(Date.now() + Number(classified.retryDelayMs || attempts * 60 * 1000)).toISOString()
      : null,
    workerLockToken: null,
    workerLockUntil: null,
    updatedAt: nowIso(),
  };
  if (retryable || task.settlementStatus !== "reserved") {
    await updateTask(task.jobId, failureData);
    return;
  }

  await db.runTransaction(async (transaction) => {
    const snapshotResult = await transaction
      .collection(SNAPSHOT_COLLECTION)
      .doc(task.ownerId)
      .get()
      .catch(() => null);
    const snapshot = snapshotResult && snapshotResult.data ? snapshotResult.data.snapshot : null;
    if (snapshot && snapshot.petData) {
      const cleanSnapshot = stripDatabaseIds(snapshot);
      const petData = stripDatabaseIds(snapshot.petData);
      const updatedAt = nowIso();
      await transaction.collection(SNAPSHOT_COLLECTION).doc(task.ownerId).set({
        data: {
          openid: task.ownerId,
          snapshot: {
            ...cleanSnapshot,
            source: "cloud",
            updatedAt,
            petData: {
              ...petData,
              balance: Number(petData.balance || 0) + Number(task.reservedPoints || 0),
              reservedBalance: Math.max(
                0,
                Number(petData.reservedBalance || 0) - Number(task.reservedPoints || 0),
              ),
            },
          },
          updatedAt,
        },
      });
    }
    await transaction.collection(ENTITLEMENT_COLLECTION).doc(task.ownerId).set({
      data: {
        ownerId: task.ownerId,
        activeJobId: null,
        customPetGenerationUsed: false,
        updatedAt: nowIso(),
      },
    });
    await transaction.collection(JOB_COLLECTION).doc(task.jobId).update({
      data: {
        ...failureData,
        settlementStatus: "released",
      },
    });
  });
}

async function runJob(jobId) {
  for (let index = 0; index < 7; index += 1) {
    const task = await claimTask(jobId);
    if (!task) {
      return getTask(jobId);
    }
    try {
      if (task.status === "uploaded" || task.status === "analyzing") {
        await processAnalyzing(task);
      } else if (task.status === "generating_idle" || task.status === "rerolling") {
        await processIdle(task);
      } else if (task.status === "generating_variants") {
        await processVariants(task);
      } else if (task.status === "validating") {
        await processValidation(task);
      } else if (task.status === "deleting") {
        await processDeletion(task);
      } else {
        return task;
      }
      await updateTask(jobId, { workerLockToken: null, workerLockUntil: null });
    } catch (error) {
      await releaseAfterFailure(task, error);
      return getTask(jobId);
    }
  }
  return getTask(jobId);
}

exports.main = async (event = {}) => {
  if (event.health === true) {
    return {
      ok: true,
      dependencies: validateRuntimeDependencies(),
    };
  }
  const jobId = String(event.jobId || "");
  if (!jobId) {
    throw new Error("job id required");
  }
  return {
    task: await runJob(jobId),
  };
};

exports.runJob = runJob;
