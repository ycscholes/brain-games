const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "user_snapshots";

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

  const nextSnapshot = normalizeSnapshot(snapshot, openid);

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
