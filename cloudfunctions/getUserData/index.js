const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "xiaoyuyuan_user_snapshots";

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { snapshot: null };
  }

  const result = await db.collection(COLLECTION).doc(openid).get().catch(() => null);
  return {
    snapshot: result && result.data ? result.data.snapshot || null : null,
  };
};
