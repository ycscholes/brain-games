const cloud = require("wx-server-sdk");
const { WORKER_STATUSES } = require("./shared/customPetDomain");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const JOB_COLLECTION = "custom_pet_jobs";
const STALE_MS = 4 * 60 * 1000;

exports.main = async () => {
  const result = await db.collection(JOB_COLLECTION).limit(100).get();
  const now = Date.now();
  const recoverable = result.data.filter((task) => {
    if (task.status === "deleting") {
      return true;
    }
    if (!WORKER_STATUSES.has(task.status)) {
      return false;
    }
    if (task.retryAfter && new Date(task.retryAfter).getTime() > now) {
      return false;
    }
    return now - new Date(task.updatedAt || task.createdAt || 0).getTime() >= STALE_MS;
  });

  const results = [];
  for (const task of recoverable.slice(0, 10)) {
    try {
      await cloud.callFunction({
        name: "customPetWorker",
        data: { jobId: task.jobId },
      });
      results.push({ jobId: task.jobId, ok: true });
    } catch (error) {
      results.push({
        jobId: task.jobId,
        ok: false,
        error: error instanceof Error ? error.message : "worker invocation failed",
      });
    }
  }
  return {
    scanned: result.data.length,
    recovered: results,
  };
};
