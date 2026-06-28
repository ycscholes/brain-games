const cloud = require("wx-server-sdk");
const { stripDatabaseIds } = require("./shared/customPetDomain");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "xiaoyuyuan_user_snapshots";

function getArrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function getPetData(snapshot) {
  return snapshot && snapshot.petData && typeof snapshot.petData === "object"
    ? snapshot.petData
    : {};
}

function getAppSettings(snapshot) {
  return snapshot && snapshot.appSettings && typeof snapshot.appSettings === "object"
    ? snapshot.appSettings
    : {};
}

function getSnapshotStats(snapshot) {
  const petData = getPetData(snapshot);
  const appSettings = getAppSettings(snapshot);
  return {
    trainingRecords: getArrayLength(snapshot && snapshot.trainingRecords),
    pets: getArrayLength(petData.pets),
    balance: Number(petData.balance || 0) + Number(petData.reservedBalance || 0),
    hasSettings: Boolean(appSettings.onboardingCompleted || appSettings.privacyAccepted),
  };
}

function hasMeaningfulData(snapshot) {
  const stats = getSnapshotStats(snapshot);
  return stats.trainingRecords > 0 || stats.pets > 0 || stats.balance > 0 || stats.hasSettings;
}

function isSuspiciousDestructiveSync(existingSnapshot, incomingSnapshot) {
  if (!hasMeaningfulData(existingSnapshot)) {
    return false;
  }

  if (!hasMeaningfulData(incomingSnapshot)) {
    return true;
  }

  const existingStats = getSnapshotStats(existingSnapshot);
  const incomingStats = getSnapshotStats(incomingSnapshot);
  const recordDrop = existingStats.trainingRecords - incomingStats.trainingRecords;

  if (existingStats.pets > 0 && incomingStats.pets === 0) {
    return true;
  }

  if (existingStats.trainingRecords >= 5 && recordDrop >= 5 && incomingStats.trainingRecords * 2 < existingStats.trainingRecords) {
    return true;
  }

  if (existingStats.balance >= 100 && incomingStats.balance === 0 && incomingStats.trainingRecords < existingStats.trainingRecords) {
    return true;
  }

  return false;
}

function getCreatedAt(existingData, existingSnapshot, incomingSnapshot, fallback) {
  return (
    existingData?.createdAt ||
    existingSnapshot?.createdAt ||
    incomingSnapshot?.createdAt ||
    fallback
  );
}

function normalizeSnapshot(snapshot, openid, createdAt, updatedAt) {
  return {
    ...stripDatabaseIds(snapshot),
    openid,
    source: "cloud",
    createdAt,
    updatedAt,
  };
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const snapshot = event && event.snapshot ? stripDatabaseIds(event.snapshot) : null;
  const allowDestructiveClear = event?.action === "clearProductData" && event?.confirmDestructiveSync === true;

  if (!openid || !snapshot) {
    throw new Error("missing openid or snapshot");
  }

  const timestamp = new Date().toISOString();
  const existing = await db.collection(COLLECTION).doc(openid).get().catch(() => null);
  const existingData = existing && existing.data ? stripDatabaseIds(existing.data) : null;
  const existingSnapshot = existingData ? stripDatabaseIds(existingData.snapshot || null) : null;
  const createdAt = getCreatedAt(existingData, existingSnapshot, snapshot, timestamp);
  const updatedAt = snapshot.updatedAt || timestamp;

  if (!allowDestructiveClear && isSuspiciousDestructiveSync(existingSnapshot, snapshot)) {
    throw new Error("destructive user snapshot sync rejected");
  }

  if (allowDestructiveClear) {
    const nextSnapshot = normalizeSnapshot(snapshot, openid, createdAt, updatedAt);
    await db.collection(COLLECTION).doc(openid).set({
      data: {
        openid,
        createdAt,
        snapshot: nextSnapshot,
        updatedAt: nextSnapshot.updatedAt,
      },
    });

    return {
      updatedAt: nextSnapshot.updatedAt,
    };
  }

  const existingPetData = existingSnapshot && existingSnapshot.petData
    ? existingSnapshot.petData
    : null;
  const incomingPetData = snapshot.petData || {};
  const existingCustomPets = existingPetData && Array.isArray(existingPetData.pets)
    ? existingPetData.pets.filter((pet) => pet.assetRef && pet.assetRef.kind === "custom")
    : [];
  const incomingPets = Array.isArray(incomingPetData.pets) ? incomingPetData.pets : [];
  const existingCustomPetIds = new Set(existingCustomPets.map((pet) => pet.id));
  const acceptedIncomingPets = incomingPets.filter(
    (pet) =>
      !pet.assetRef ||
      pet.assetRef.kind !== "custom" ||
      existingCustomPetIds.has(pet.id),
  );
  const incomingPetIds = new Set(acceptedIncomingPets.map((pet) => pet.id));
  const mergedPets = [
    ...acceptedIncomingPets,
    ...existingCustomPets.filter((pet) => !incomingPetIds.has(pet.id)),
  ];
  const hasReservation = Number(existingPetData && existingPetData.reservedBalance) > 0;
  const nextSnapshot = normalizeSnapshot({
    ...snapshot,
    petData: {
      ...incomingPetData,
      pets: mergedPets,
      balance: hasReservation ? existingPetData.balance : incomingPetData.balance,
      reservedBalance: hasReservation
        ? existingPetData.reservedBalance
        : Number(incomingPetData.reservedBalance || 0),
    },
  }, openid, createdAt, updatedAt);

  await db.collection(COLLECTION).doc(openid).set({
    data: {
      openid,
      createdAt,
      snapshot: nextSnapshot,
      updatedAt: nextSnapshot.updatedAt,
    },
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
  };
};
