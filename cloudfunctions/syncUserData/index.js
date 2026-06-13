const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "xiaoyuyuan_user_snapshots";

function normalizeSnapshot(snapshot, openid) {
  return {
    ...snapshot,
    openid,
    source: "cloud",
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  };
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const snapshot = event && event.snapshot ? event.snapshot : null;

  if (!openid || !snapshot) {
    throw new Error("missing openid or snapshot");
  }

  const existing = await db.collection(COLLECTION).doc(openid).get().catch(() => null);
  const existingSnapshot = existing && existing.data ? existing.data.snapshot || null : null;
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
  }, openid);

  await db.collection(COLLECTION).doc(openid).set({
    data: {
      openid,
      snapshot: nextSnapshot,
      updatedAt: nextSnapshot.updatedAt,
    },
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
  };
};
