export const CLOUD_ENV_ID =
  typeof __CLOUD_ENV_ID__ !== "undefined" ? __CLOUD_ENV_ID__ : process.env.TARO_CLOUD_ENV_ID || "";
export const CLOUD_SCHEMA_VERSION = 1;
