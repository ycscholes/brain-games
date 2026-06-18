const cloud = require("wx-server-sdk");
const {
  CUSTOM_PET_MOODS,
  CUSTOM_PET_PRICE,
  getOwnerRoot,
  isActiveStatus,
  sanitizeTask,
  stripDatabaseIds,
} = require("./shared/customPetDomain");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const SNAPSHOT_COLLECTION = "xiaoyuyuan_user_snapshots";
const JOB_COLLECTION = "custom_pet_jobs";
const ENTITLEMENT_COLLECTION = "custom_pet_entitlements";
const ASSET_COLLECTION = "custom_pet_assets";

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function requireOpenId() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    throw new Error("unauthorized");
  }
  return OPENID;
}

async function getSnapshot(transaction, ownerId) {
  const result = await transaction.collection(SNAPSHOT_COLLECTION).doc(ownerId).get().catch(() => null);
  return result && result.data ? result.data.snapshot || null : null;
}

function getPetData(snapshot) {
  const petData = snapshot && snapshot.petData
    ? snapshot.petData
    : {
        pets: [],
        activePetId: null,
        balance: 0,
        reservedBalance: 0,
        adoptedCount: 0,
        lastCheckTime: nowIso(),
      };
  return stripDatabaseIds(petData);
}

async function writeSnapshot(transaction, ownerId, snapshot, petData) {
  const updatedAt = nowIso();
  const cleanSnapshot = stripDatabaseIds(snapshot || {});
  const nextSnapshot = stripDatabaseIds({
    ...cleanSnapshot,
    schemaVersion: cleanSnapshot.schemaVersion || 1,
    openid: ownerId,
    source: "cloud",
    updatedAt,
    trainingRecords: Array.isArray(cleanSnapshot.trainingRecords) ? cleanSnapshot.trainingRecords : [],
    appSettings: cleanSnapshot.appSettings || {},
    petData,
  });
  await transaction.collection(SNAPSHOT_COLLECTION).doc(ownerId).set({
    data: {
      openid: ownerId,
      snapshot: nextSnapshot,
      updatedAt,
    },
  });
  return nextSnapshot;
}

async function getOwnedTask(ownerId, jobId) {
  if (!jobId) {
    return null;
  }
  const result = await db.collection(JOB_COLLECTION).doc(jobId).get().catch(() => null);
  const task = result && result.data ? result.data : null;
  return task && task.ownerId === ownerId ? task : null;
}

async function findCurrentTask(ownerId) {
  const result = await db
    .collection(JOB_COLLECTION)
    .where({ ownerId })
    .limit(20)
    .get();
  return result.data
    .filter((task) => task.status !== "deleted")
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))[0] || null;
}

async function getStatus(ownerId) {
  const [task, entitlementResult] = await Promise.all([
    findCurrentTask(ownerId),
    db.collection(ENTITLEMENT_COLLECTION).doc(ownerId).get().catch(() => null),
  ]);
  return {
    task: sanitizeTask(task),
    generationUsed: Boolean(
      entitlementResult &&
      entitlementResult.data &&
      entitlementResult.data.customPetGenerationUsed,
    ),
  };
}

async function createUploadIntent(ownerId) {
  const [entitlementResult, activeResult, snapshotResult] = await Promise.all([
    db.collection(ENTITLEMENT_COLLECTION).doc(ownerId).get().catch(() => null),
    db
      .collection(JOB_COLLECTION)
      .where({ ownerId })
      .limit(10)
      .get(),
    db.collection(SNAPSHOT_COLLECTION).doc(ownerId).get().catch(() => null),
  ]);
  if (entitlementResult && entitlementResult.data && entitlementResult.data.customPetGenerationUsed) {
    throw new Error("custom pet generation already used");
  }
  if (activeResult.data.some((task) => isActiveStatus(task.status))) {
    throw new Error("custom pet task already active");
  }
  const snapshot = snapshotResult && snapshotResult.data ? snapshotResult.data.snapshot : null;
  if (Number(snapshot?.petData?.balance || 0) < CUSTOM_PET_PRICE) {
    throw new Error("insufficient pet points");
  }

  const jobId = createId("custom_pet_job");
  return {
    jobId,
    cloudPath: `${getOwnerRoot(ownerId, jobId)}/source/source.jpg`,
    maxBytes: 4 * 1024 * 1024,
  };
}

async function submit(ownerId, event) {
  const jobId = String(event.jobId || "");
  const sourceFileId = String(event.sourceFileId || "");
  const expectedSourcePath = ["", "users", ownerId, "custom-pets", jobId, ""].join("/");
  if (!jobId || !sourceFileId || !sourceFileId.includes(expectedSourcePath)) {
    throw new Error("invalid source file");
  }

  return db.runTransaction(async (transaction) => {
    const [snapshot, entitlementResult, existingTaskResult] = await Promise.all([
      getSnapshot(transaction, ownerId),
      transaction.collection(ENTITLEMENT_COLLECTION).doc(ownerId).get().catch(() => null),
      transaction.collection(JOB_COLLECTION).doc(jobId).get().catch(() => null),
    ]);
    if (entitlementResult && entitlementResult.data && entitlementResult.data.customPetGenerationUsed) {
      throw new Error("custom pet generation already used");
    }
    if (
      entitlementResult &&
      entitlementResult.data &&
      entitlementResult.data.activeJobId &&
      entitlementResult.data.activeJobId !== jobId
    ) {
      throw new Error("custom pet task already active");
    }
    if (existingTaskResult && existingTaskResult.data) {
      return {
        task: sanitizeTask(existingTaskResult.data),
        snapshot,
      };
    }

    const petData = getPetData(snapshot);
    const reservedBalance = Number(petData.reservedBalance || 0);
    if (Number(petData.balance || 0) < CUSTOM_PET_PRICE) {
      throw new Error("insufficient pet points");
    }

    const createdAt = nowIso();
    const task = {
      jobId,
      ownerId,
      status: "uploaded",
      step: "uploaded",
      sourceFileId,
      candidateVersion: 1,
      candidateSpriteFileIds: {},
      mappedSkin: null,
      speciesLabel: null,
      traits: null,
      reservedPoints: CUSTOM_PET_PRICE,
      settlementStatus: "reserved",
      rerollUsed: false,
      attemptsByStep: {},
      errorCode: null,
      errorCategory: null,
      createdAt,
      updatedAt: createdAt,
    };
    await transaction.collection(JOB_COLLECTION).doc(jobId).set({ data: task });
    await transaction.collection(ENTITLEMENT_COLLECTION).doc(ownerId).set({
      data: {
        ...stripDatabaseIds(entitlementResult && entitlementResult.data ? entitlementResult.data : {}),
        ownerId,
        activeJobId: jobId,
        customPetGenerationUsed: false,
        updatedAt: createdAt,
      },
    });
    const nextSnapshot = await writeSnapshot(transaction, ownerId, snapshot, {
      ...petData,
      balance: Number(petData.balance || 0) - CUSTOM_PET_PRICE,
      reservedBalance: reservedBalance + CUSTOM_PET_PRICE,
    });
    const result = {
      task: sanitizeTask(task),
      snapshot: nextSnapshot,
    };
    return result;
  });
}

async function reroll(ownerId, event) {
  const task = await getOwnedTask(ownerId, String(event.jobId || ""));
  if (!task || task.status !== "preview_ready") {
    throw new Error("custom pet preview unavailable");
  }
  if (task.rerollUsed) {
    throw new Error("custom pet reroll already used");
  }

  const updatedAt = nowIso();
  await db.collection(JOB_COLLECTION).doc(task.jobId).update({
    data: {
      status: "rerolling",
      step: "rerolling",
      rerollUsed: true,
      previousCandidateVersion: task.candidateVersion,
      previousCandidateSpriteFileIds: task.candidateSpriteFileIds,
      candidateVersion: Number(task.candidateVersion || 1) + 1,
      candidateSpriteFileIds: {},
      errorCode: null,
      errorCategory: null,
      updatedAt,
    },
  });
  return sanitizeTask({
    ...task,
    status: "rerolling",
    step: "rerolling",
    rerollUsed: true,
    candidateVersion: Number(task.candidateVersion || 1) + 1,
    updatedAt,
  });
}

async function adopt(ownerId, event) {
  const jobId = String(event.jobId || "");
  const name = String(event.name || "").trim().slice(0, 10);
  if (!jobId || !name) {
    throw new Error("pet name required");
  }

  return db.runTransaction(async (transaction) => {
    const [taskResult, entitlementResult, snapshot] = await Promise.all([
      transaction.collection(JOB_COLLECTION).doc(jobId).get(),
      transaction.collection(ENTITLEMENT_COLLECTION).doc(ownerId).get().catch(() => null),
      getSnapshot(transaction, ownerId),
    ]);
    const task = taskResult.data;
    if (!task || task.ownerId !== ownerId) {
      throw new Error("custom pet task not found");
    }
    if (task.status === "adopted" && task.petId) {
      return {
        petId: task.petId,
        snapshot,
      };
    }
    if (task.status !== "preview_ready") {
      throw new Error("custom pet preview unavailable");
    }
    if (
      !entitlementResult ||
      !entitlementResult.data ||
      entitlementResult.data.jobId !== jobId ||
      !entitlementResult.data.customPetGenerationUsed
    ) {
      throw new Error("custom pet entitlement mismatch");
    }
    if (!CUSTOM_PET_MOODS.every((mood) => task.candidateSpriteFileIds[mood])) {
      throw new Error("custom pet images incomplete");
    }

    const petData = getPetData(snapshot);
    const petId = createId("pet");
    const timestamp = nowIso();
    const pet = {
      id: petId,
      name,
      skin: task.mappedSkin,
      assetRef: {
        kind: "custom",
        templateSkin: task.mappedSkin,
        customAssetId: jobId,
      },
      status: "alive",
      hunger: 100,
      level: 1,
      experience: 0,
      createdAt: timestamp,
      lastUpdated: timestamp,
      deathTime: null,
    };
    const nextSnapshot = await writeSnapshot(transaction, ownerId, snapshot, {
      ...petData,
      pets: [...(petData.pets || []), pet],
      activePetId: petId,
      reservedBalance: Math.max(0, Number(petData.reservedBalance || 0) - CUSTOM_PET_PRICE),
      adoptedCount: Number(petData.adoptedCount || 0) + 1,
      lastCheckTime: timestamp,
    });
    await transaction.collection(ASSET_COLLECTION).doc(jobId).set({
      data: {
        assetId: jobId,
        ownerId,
        templateSkin: task.mappedSkin,
        speciesLabel: task.speciesLabel || null,
        moodFileIds: task.candidateSpriteFileIds,
        sourceFileId: task.sourceFileId,
        aiGenerated: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
    await transaction.collection(JOB_COLLECTION).doc(jobId).update({
      data: {
        status: "adopted",
        step: "adopted",
        settlementStatus: "spent",
        petId,
        updatedAt: timestamp,
      },
    });
    await transaction.collection(ENTITLEMENT_COLLECTION).doc(ownerId).update({
      data: {
        activeJobId: null,
        updatedAt: timestamp,
      },
    });
    return {
      petId,
      snapshot: nextSnapshot,
    };
  });
}

async function cancel(ownerId, event) {
  const jobId = String(event.jobId || "");
  return db.runTransaction(async (transaction) => {
    const [taskResult, snapshot] = await Promise.all([
      transaction.collection(JOB_COLLECTION).doc(jobId).get(),
      getSnapshot(transaction, ownerId),
    ]);
    const task = taskResult.data;
    if (!task || task.ownerId !== ownerId) {
      throw new Error("custom pet task not found");
    }
    if (task.status === "cancelled") {
      return { task: sanitizeTask(task), snapshot };
    }
    if (task.status === "adopted" || task.status === "deleted") {
      throw new Error("custom pet task cannot be cancelled");
    }
    const petData = getPetData(snapshot);
    const shouldRefund = task.settlementStatus === "reserved";
    const nextSnapshot = shouldRefund
      ? await writeSnapshot(transaction, ownerId, snapshot, {
          ...petData,
          balance: Number(petData.balance || 0) + CUSTOM_PET_PRICE,
          reservedBalance: Math.max(0, Number(petData.reservedBalance || 0) - CUSTOM_PET_PRICE),
        })
      : snapshot;
    const updatedAt = nowIso();
    await transaction.collection(JOB_COLLECTION).doc(jobId).update({
      data: {
        status: "cancelled",
        step: "cancelled",
        settlementStatus: shouldRefund ? "released" : task.settlementStatus,
        updatedAt,
      },
    });
    await transaction.collection(ENTITLEMENT_COLLECTION).doc(ownerId).set({
      data: {
        ownerId,
        activeJobId: null,
        customPetGenerationUsed: Boolean(task.status === "preview_ready" || task.rerollUsed),
        usedAt: task.status === "preview_ready" || task.rerollUsed ? task.updatedAt : null,
        updatedAt,
      },
    });
    return {
      task: sanitizeTask({ ...task, status: "cancelled", updatedAt }),
      snapshot: nextSnapshot,
    };
  });
}

async function remove(ownerId, event) {
  const petId = String(event.petId || "");
  if (!petId) {
    throw new Error("pet id required");
  }
  return db.runTransaction(async (transaction) => {
    const snapshot = await getSnapshot(transaction, ownerId);
    const petData = getPetData(snapshot);
    const pet = (petData.pets || []).find((item) => item.id === petId);
    if (!pet || !pet.assetRef || pet.assetRef.kind !== "custom") {
      throw new Error("custom pet not found");
    }
    const assetId = pet.assetRef.customAssetId;
    const taskResult = await transaction.collection(JOB_COLLECTION).doc(assetId).get();
    const nextPets = petData.pets.filter((item) => item.id !== petId);
    const nextSnapshot = await writeSnapshot(transaction, ownerId, snapshot, {
      ...petData,
      pets: nextPets,
      activePetId:
        petData.activePetId === petId
          ? nextPets.find((item) => item.status !== "dead")?.id || nextPets[0]?.id || null
          : petData.activePetId,
    });
    await transaction.collection(JOB_COLLECTION).doc(assetId).update({
      data: {
        status: "deleting",
        step: "deleting",
        updatedAt: nowIso(),
      },
    });
    return {
      task: sanitizeTask({ ...taskResult.data, status: "deleting" }),
      snapshot: nextSnapshot,
    };
  });
}

async function getAssetUrls(ownerId, event) {
  const assetId = String(event.assetId || "");
  const [assetResult, taskResult] = await Promise.all([
    db.collection(ASSET_COLLECTION).doc(assetId).get().catch(() => null),
    db.collection(JOB_COLLECTION).doc(assetId).get().catch(() => null),
  ]);
  const asset = assetResult && assetResult.data
    ? assetResult.data
    : taskResult && taskResult.data
      ? {
          ownerId: taskResult.data.ownerId,
          moodFileIds: taskResult.data.candidateSpriteFileIds,
        }
      : null;
  if (!asset || asset.ownerId !== ownerId) {
    throw new Error("custom pet asset not found");
  }
  const moods = Array.isArray(event.moods)
    ? event.moods.filter((mood) => CUSTOM_PET_MOODS.includes(mood))
    : CUSTOM_PET_MOODS;
  const requestedFiles = moods
    .map((mood) => ({ mood, fileID: asset.moodFileIds[mood] }))
    .filter((item) => Boolean(item.fileID));
  const urls = await cloud.getTempFileURL({
    fileList: requestedFiles.map((item) => item.fileID),
  });
  return {
    assetId,
    urls: requestedFiles.reduce((acc, requestedFile, index) => {
      const item = urls.fileList[index];
      if (item && item.tempFileURL) {
        acc[requestedFile.mood] = {
          url: item.tempFileURL,
          maxAge: item.maxAge,
        };
      }
      return acc;
    }, {}),
  };
}

async function dispatch(ownerId, event) {
  switch (event.action) {
    case "createUploadIntent":
      return createUploadIntent(ownerId);
    case "submit":
      {
        const result = await submit(ownerId, event);
        void cloud.callFunction({
          name: "customPetWorker",
          data: { jobId: event.jobId },
        }).catch(() => null);
        return result;
      }
    case "getStatus":
      return getStatus(ownerId);
    case "reroll":
      {
        const task = await reroll(ownerId, event);
        void cloud.callFunction({
          name: "customPetWorker",
          data: { jobId: event.jobId },
        }).catch(() => null);
        return { task };
      }
    case "adopt":
      return adopt(ownerId, event);
    case "cancel":
      return cancel(ownerId, event);
    case "delete":
      {
        const result = await remove(ownerId, event);
        void cloud.callFunction({
          name: "customPetWorker",
          data: { jobId: result.task.jobId },
        }).catch(() => null);
        return result;
      }
    case "getAssetUrls":
      return getAssetUrls(ownerId, event);
    default:
      throw new Error("unsupported custom pet action");
  }
}

exports.main = async (event = {}) => {
  try {
    const ownerId = requireOpenId();
    const data = await dispatch(ownerId, event);
    return {
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "custom pet operation failed",
    };
  }
};
