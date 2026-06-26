const {
  DEFAULT_CUSTOM_PET_TRAITS,
  normalizeMappedSkin,
} = require("./customPetDomain");
const https = require("https");

function getJimp() {
  return require("jimp");
}

function getCloudBaseSdk() {
  return require("@cloudbase/node-sdk");
}

function getAiArtSdk() {
  return require("tencentcloud-sdk-nodejs-aiart").aiart;
}

function getWxServerSdk() {
  return require("wx-server-sdk");
}

function readFirstEnv(keys) {
  return keys.map((key) => process.env[key]).find((value) => value);
}

const DEFAULT_IMAGE_GENERATION_FUNCTION_NAME = "customPetImageGenerator";
// Multi-reference generation uses Tencent AIArt async jobs. The 90 x 5s window
// matches the worker lock TTL and gives the provider enough time for image jobs
// without blocking a locked task indefinitely.
const REFERENCED_SHEET_POLL_ATTEMPTS = 90;
const REFERENCED_SHEET_POLL_INTERVAL_MS = 5000;

const DEFAULT_ANALYSIS = {
  speciesLabel: "自定义宠物",
  mappedSkin: "cat",
  traits: DEFAULT_CUSTOM_PET_TRAITS,
};

function parseJsonObject(text) {
  const value = String(text || "").trim();
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeAnalysis(value) {
  const traits = value && value.traits && typeof value.traits === "object" ? value.traits : {};
  return {
    speciesLabel: String(value && value.speciesLabel ? value.speciesLabel : DEFAULT_ANALYSIS.speciesLabel)
      .trim()
      .slice(0, 30),
    mappedSkin: normalizeMappedSkin(value && value.mappedSkin),
    traits: {
      ...DEFAULT_CUSTOM_PET_TRAITS,
      ...traits,
    },
  };
}

async function analyzeSource({ sourceBuffer, mimeType = "image/jpeg", app }) {
  try {
    const tcb = getCloudBaseSdk();
    const cloudApp = app || tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
    const model = cloudApp.ai().createModel("hunyuan-exp");
    const result = await model.generateText({
      model: "hunyuan-2.0-instruct-20251111",
      messages: [
        {
          role: "system",
          content:
            "你是宠物图像分析器。只输出 JSON，不要解释。mappedSkin 只能是 cat,dog,rabbit,bear,panda,gecko,turtle。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "识别单只宠物，输出 speciesLabel、mappedSkin、traits。traits 包含 primaryColor、secondaryColor、markings、bodyShape、accessories。",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${sourceBuffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    });
    return normalizeAnalysis(parseJsonObject(result.text));
  } catch {
    return DEFAULT_ANALYSIS;
  }
}

const REFERENCE_VISUAL_TRAITS_PROMPT =
  "视觉特征：按第 1 张参考图保留主色、辅色、纹理分布、体型轮廓、脸部轮廓和原有配饰";
const EXTRA_CONTENT_NEGATIVE_PROMPT =
  "每格只保留宠物本体及原有配饰，禁止出现其它角色、互动肢体、餐饮元素、器皿、玩具、特效、光环、场景物件";

function buildMoodPrompt({ mood }) {
  const moodText = {
    idle: "自然站立或坐着，平静看向前方",
    feed: "保持参考状态的愉快表情和身体姿态，嘴部可有轻微动作",
    cuddle: "亲昵地靠近并露出放松享受的表情",
    hungry: "略显饥饿和期待，姿态仍然可爱，不要悲惨",
  }[mood];
  return [
    `单只第 1 张参考图中的宠物全身角色，${moodText}`,
    "固定水彩绘本风格，儿童友好，轮廓清楚，主体居中",
    "纯亮绿色背景 #00FF00，无场景、无地面、无投影、无边框、无文字",
    REFERENCE_VISUAL_TRAITS_PROMPT,
    EXTRA_CONTENT_NEGATIVE_PROMPT,
    "保留第 1 张参考图的身份和外观，每格四周保留安全边距",
  ].join("。").slice(0, 250);
}

function buildMoodSheetPrompt({ includeReferenceRoles = false }) {
  // This prompt is part of the runtime contract with splitMoodSheet(): it must
  // keep a deterministic 2x2 layout so the worker can crop by coordinates and
  // still publish the existing four mood files expected by the mini program.
  return [
    includeReferenceRoles
      ? "参考图规则：第 1 张用户上传图是唯一宠物身份和外观来源，最高优先级；四格必须以第 1 张的物种、脸型、耳朵、眼睛、嘴吻、身体比例、毛色、花纹分布、尾巴和原有配饰为准；第 2 张灰色无物种姿态图仅参考 idle、feed、cuddle、hungry 的姿态、构图、表情和水彩画风；禁止参考第 2 张的任何外观特征，包括头部形状、身体形状、颜色、纹理和比例；不得变成其它动物；两张图冲突时始终以第 1 张为准，角色身份一致性优先于姿态一致性"
      : "",
    "生成第 1 张参考图中的同一只宠物四状态角色设定图，2x2 四宫格",
    "左上 idle：同一只第 1 张宠物自然站立或坐着，平静看向前方",
    "右上 feed：同一只第 1 张宠物参考第 2 张右上姿态和开心表情，仅允许嘴部轻微动作，不出现食物或食盆",
    "左下 cuddle：同一只第 1 张宠物参考第 2 张左下姿态和放松表情，不出现爱心、抱枕或玩具",
    "右下 hungry：同一只第 1 张宠物参考第 2 张右下期待姿态和可爱表情，不要悲伤",
    "四格必须一眼认出是第 1 张参考图中的同一只宠物，物种、脸型、耳朵、眼睛、嘴吻、身体比例、毛色、花纹、尾巴和原有配饰完全一致",
    "纯亮绿色背景 #00FF00，无场景、无地面、无投影、无边框、无文字、无标签",
    REFERENCE_VISUAL_TRAITS_PROMPT,
    `${EXTRA_CONTENT_NEGATIVE_PROMPT}，尤其禁止食物、食盆、爱心、抱枕、玩具和特效`,
    "儿童绘本水彩风格，主体居中，只调整姿态和表情",
  ].filter(Boolean).join("。").slice(0, includeReferenceRoles ? 900 : 560);
}

function createAiArtClient() {
  const aiart = getAiArtSdk();
  const Client = aiart.v20221229.Client;
  // CloudBase/SCF rejects custom environment variable names prefixed with
  // TENCENTCLOUD_, so production functions use CUSTOM_PET_AIART_* aliases.
  // Keep the official Tencent Cloud names as local/CI fallbacks because the
  // SDK and many developer shells already use them.
  const secretId = readFirstEnv([
    "CUSTOM_PET_AIART_SECRET_ID",
    "AIART_SECRET_ID",
    "TENCENTCLOUD_SECRET_ID",
    "TENCENTCLOUD_SECRETID",
  ]);
  const secretKey = readFirstEnv([
    "CUSTOM_PET_AIART_SECRET_KEY",
    "AIART_SECRET_KEY",
    "TENCENTCLOUD_SECRET_KEY",
    "TENCENTCLOUD_SECRETKEY",
  ]);
  const token = readFirstEnv([
    "CUSTOM_PET_AIART_SESSION_TOKEN",
    "AIART_SESSION_TOKEN",
    "TENCENTCLOUD_SESSION_TOKEN",
    "TENCENTCLOUD_SESSIONTOKEN",
  ]);
  const region = readFirstEnv([
    "CUSTOM_PET_AIART_REGION",
    "AIART_REGION",
    "TENCENTCLOUD_AI_REGION",
  ]);
  return new Client({
    ...(secretId && secretKey
      ? {
          credential: {
            secretId,
            secretKey,
            token,
          },
        }
      : {}),
    region: region || "ap-guangzhou",
    profile: {
      httpProfile: {
        reqTimeout: 240,
      },
    },
  });
}

function createCloudBaseImageModel(app) {
  const tcb = getCloudBaseSdk();
  const cloudApp = app || tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
  return cloudApp.ai().createImageModel("hunyuan-image");
}

function downloadRemoteImage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`image download failed: ${response.statusCode || "unknown"}`));
          response.resume();
          return;
        }
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function generateCloudBaseImage({ mood, traits, speciesLabel, imageModel, downloadImage }) {
  const prompt = buildMoodPrompt({ mood, traits, speciesLabel });
  if (!imageModel) {
    // In wx-server-sdk cloud functions the shared generator cannot always init
    // CloudBase AI directly, so production can route through the image helper function.
    return generateCloudBaseFunctionImage({ prompt, downloadImage });
  }
  return generateCloudBaseSdkImage({ prompt, imageModel, downloadImage });
}

async function generateCloudBaseSheetImage({ traits, speciesLabel, imageModel, downloadImage }) {
  const prompt = buildMoodSheetPrompt({ traits, speciesLabel });
  if (!imageModel) {
    // Same transport as single-mood CloudBase generation, but the prompt asks for
    // all states in one sheet so the worker can split locally.
    return generateCloudBaseFunctionImage({ prompt, downloadImage });
  }
  return generateCloudBaseSdkImage({ prompt, imageModel, downloadImage });
}

function parseImageGenerationFunctionResult(response) {
  const result = response && response.result ? response.result : response;
  if (result && result.success === false) {
    const error = new Error(result.message || "CloudBase image generation failed");
    error.code = result.code || "Error";
    throw error;
  }
  if (result && result.success === true && result.imageUrl) {
    return {
      imageUrl: result.imageUrl,
      revisedPrompt: result.revised_prompt || null,
    };
  }
  if (result && result.imageUrl) {
    return {
      imageUrl: result.imageUrl,
      revisedPrompt: result.revised_prompt || null,
    };
  }
  if (result && result.data && result.data[0] && result.data[0].url) {
    return {
      imageUrl: result.data[0].url,
      revisedPrompt: result.data[0].revised_prompt || null,
    };
  }
  throw new Error("CloudBase image response is empty");
}

async function generateCloudBaseFunctionImage({ prompt, cloudFunction, downloadImage }) {
  const caller =
    cloudFunction ||
    ((params) => {
      const cloud = getWxServerSdk();
      return cloud.callFunction(params);
    });
  const functionName =
    process.env.CUSTOM_PET_IMAGE_FUNCTION_NAME || DEFAULT_IMAGE_GENERATION_FUNCTION_NAME;
  const response = await caller({
    name: functionName,
    data: { prompt },
  });
  const { imageUrl } = parseImageGenerationFunctionResult(response);
  return (downloadImage || downloadRemoteImage)(imageUrl);
}

async function generateCloudBaseSdkImage({ prompt, imageModel, downloadImage }) {
  const model = imageModel || createCloudBaseImageModel();
  const response = await model.generateImage({
    model: "hunyuan-image",
    prompt,
    negative_prompt: "多人，多只动物，场景，地面，阴影，文字，边框，水印，裁切，模糊，畸形",
    size: "1024x1024",
    version: "v1.9",
    revise: false,
    n: 1,
  });
  const url = response && response.data && response.data[0] && response.data[0].url;
  if (!url) {
    throw new Error("CloudBase image response is empty");
  }
  return (downloadImage || downloadRemoteImage)(url);
}

async function generateAiArtImage({ referenceBuffer, mood, traits, speciesLabel, client }) {
  const aiClient = client || createAiArtClient();
  // Legacy fallback path: ImageToImage has stronger single-reference behavior
  // but can only generate one target image at a time.
  const response = await aiClient.ImageToImage({
    InputImage: referenceBuffer.toString("base64"),
    Prompt: buildMoodPrompt({ mood, traits, speciesLabel }),
    NegativePrompt: "多人，多只动物，场景，地面，阴影，文字，边框，水印，裁切，模糊，畸形",
    Styles: ["104"],
    ResultConfig: {
      Resolution: "768:768",
    },
    LogoAdd: 0,
    Strength: mood === "idle" ? 0.62 : 0.48,
    RspImgType: "base64",
    EnhanceImage: 1,
  });
  if (!response.ResultImage) {
    throw new Error("AI image response is empty");
  }
  return Buffer.from(response.ResultImage, "base64");
}

async function generateAiArtSheetImage({ referenceBuffer, traits, speciesLabel, client }) {
  const aiClient = client || createAiArtClient();
  // Single-reference sheet fallback used when multi-reference text-to-image is
  // unavailable. It still reduces the four mood calls to one generated sheet.
  const response = await aiClient.ImageToImage({
    InputImage: referenceBuffer.toString("base64"),
    Prompt: buildMoodSheetPrompt({ traits, speciesLabel }),
    NegativePrompt: "多人，多只动物，场景，地面，阴影，文字，边框，水印，裁切，模糊，畸形",
    Styles: ["104"],
    ResultConfig: {
      Resolution: "1024:1024",
    },
    LogoAdd: 0,
    Strength: 0.56,
    RspImgType: "base64",
    EnhanceImage: 1,
  });
  if (!response.ResultImage) {
    throw new Error("AI image response is empty");
  }
  return Buffer.from(response.ResultImage, "base64");
}

function unwrapTencentResponse(response) {
  // Unit tests use plain mock payloads, while the Tencent SDK wraps live results
  // under Response. Normalize both forms before reading JobId/status fields.
  return response && response.Response ? response.Response : response;
}

async function pollTextToImageJob({
  jobId,
  client,
  sleepFn = sleep,
  maxAttempts = REFERENCED_SHEET_POLL_ATTEMPTS,
  intervalMs = REFERENCED_SHEET_POLL_INTERVAL_MS,
}) {
  // Tencent AIArt text-to-image is asynchronous; only status 5 exposes usable ResultImage URLs.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = unwrapTencentResponse(await client.QueryTextToImageJob({ JobId: jobId }));
    const statusCode = String(result?.JobStatusCode || "");
    if (statusCode === "5") {
      const imageUrl = result.ResultImage?.[0];
      if (!imageUrl) {
        throw new Error("Tencent AIArt text-to-image result is empty");
      }
      return {
        imageUrl,
        revisedPrompt: result.RevisedPrompt?.[0] || null,
      };
    }
    if (statusCode === "4") {
      // Provider-declared failure should surface immediately so the worker can
      // switch to the single-reference path instead of waiting for timeout.
      const error = new Error(result?.JobErrorMsg || "Tencent AIArt text-to-image job failed");
      error.code = result?.JobErrorCode || "TextToImageJobFailed";
      throw error;
    }
    if (attempt < maxAttempts - 1) {
      await sleepFn(intervalMs);
    }
  }
  const error = new Error("Tencent AIArt text-to-image job timed out");
  error.code = "TextToImageJobTimeout";
  throw error;
}

async function generateReferencedMoodSheet({
  userReferenceBuffer,
  poseReferenceBuffer,
  traits,
  speciesLabel,
  client,
  downloadImage,
  sleepFn,
  maxAttempts,
  intervalMs,
}) {
  const aiClient = client || createAiArtClient();
  // SubmitTextToImageJob accepts multiple reference images, unlike ImageToImage's single InputImage.
  // Put the user photo first because it is the identity source; the second image is only a pose/style guide.
  const submitResult = unwrapTencentResponse(await aiClient.SubmitTextToImageJob({
    Prompt: buildMoodSheetPrompt({ traits, speciesLabel, includeReferenceRoles: true }),
    Images: [
      userReferenceBuffer.toString("base64"),
      poseReferenceBuffer.toString("base64"),
    ],
    Resolution: "1024:1024",
    LogoAdd: 0,
    Revise: 0,
  }));
  const jobId = submitResult?.JobId;
  if (!jobId) {
    throw new Error("Tencent AIArt text-to-image job id is empty");
  }
  // The job returns a temporary image URL instead of bytes, so keep downloading
  // inside this helper and expose the same Buffer contract as the other generators.
  const { imageUrl } = await pollTextToImageJob({
    jobId,
    client: aiClient,
    sleepFn,
    maxAttempts,
    intervalMs,
  });
  return (downloadImage || downloadRemoteImage)(imageUrl);
}

async function generateMood({ referenceBuffer, mood, traits, speciesLabel, client }) {
  const provider = process.env.CUSTOM_PET_IMAGE_PROVIDER || "cloudbase";
  if (provider === "aiart") {
    // aiart mode is kept for environments that have Tencent AIArt credentials
    // and want image-to-image reference control for the legacy per-mood fallback.
    return generateAiArtImage({ referenceBuffer, mood, traits, speciesLabel, client });
  }
  return generateCloudBaseImage({ mood, traits, speciesLabel, imageModel: client });
}

async function generateMoodSheet({ referenceBuffer, traits, speciesLabel, client }) {
  const provider = process.env.CUSTOM_PET_IMAGE_PROVIDER || "cloudbase";
  if (provider === "aiart") {
    // This is the one-reference sheet fallback after generateReferencedMoodSheet fails.
    return generateAiArtSheetImage({ referenceBuffer, traits, speciesLabel, client });
  }
  return generateCloudBaseSheetImage({ traits, speciesLabel, imageModel: client });
}

async function splitMoodSheet({ inputBuffer }) {
  const { Jimp, JimpMime } = getJimp();
  const image = await Jimp.read(inputBuffer);
  const cellWidth = Math.floor(image.bitmap.width / 2);
  const cellHeight = Math.floor(image.bitmap.height / 2);
  if (cellWidth <= 0 || cellHeight <= 0) {
    throw new Error("generated mood sheet is too small");
  }
  // The generation prompt and cat reference both use this 2x2 order; changing it requires updating both.
  const frames = {
    idle: { x: 0, y: 0 },
    feed: { x: cellWidth, y: 0 },
    cuddle: { x: 0, y: cellHeight },
    hungry: { x: cellWidth, y: cellHeight },
  };
  const output = {};
  for (const [mood, frame] of Object.entries(frames)) {
    // Split first and normalize each cell separately so each mood keeps the same
    // 768x768 transparent PNG contract as older custom pet assets.
    const cell = image.clone().crop({
      x: frame.x,
      y: frame.y,
      w: cellWidth,
      h: cellHeight,
    });
    output[mood] = await cell.getBuffer(JimpMime.png);
  }
  return output;
}

async function normalizeSprite({ inputBuffer }) {
  const { Jimp, JimpMime } = getJimp();
  const image = await Jimp.read(inputBuffer);
  // The model renders on #00FF00 chroma key; containment fills any short edges
  // with the same key before alpha removal so crop bounds stay predictable.
  image.contain({
    w: 768,
    h: 768,
    color: 0x00ff00ff,
  });

  let minX = image.bitmap.width;
  let minY = image.bitmap.height;
  let maxX = -1;
  let maxY = -1;
  image.scan((x, y, offset) => {
    const red = image.bitmap.data[offset];
    const green = image.bitmap.data[offset + 1];
    const blue = image.bitmap.data[offset + 2];
    const greenDistance = Math.max(Math.abs(red), Math.abs(255 - green), Math.abs(blue));
    if (greenDistance < 42 || (green > red * 1.55 && green > blue * 1.55 && green > 120)) {
      // Remove both exact #00FF00 and anti-aliased green spill around the sprite.
      image.bitmap.data[offset + 3] = 0;
      return;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  if (maxX < minX || maxY < minY) {
    throw new Error("generated image has no visible subject");
  }
  image
    .crop({
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    })
    .scaleToFit({ w: 660, h: 660 });
  // Center on a stable 768 canvas so frontend Image sizing does not need to know
  // whether the source came from sheets, per-mood generation, or old assets.
  const canvas = new Jimp({
    width: 768,
    height: 768,
    color: 0x00000000,
  });
  canvas.composite(
    image,
    Math.round((768 - image.bitmap.width) / 2),
    Math.round((768 - image.bitmap.height) / 2),
  );
  const png = await canvas.getBuffer(JimpMime.png);
  return addPngTextChunk(png, "AI-Generated", "Cici Custom Pet");
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function addPngTextChunk(png, keyword, text) {
  const type = Buffer.from("tEXt");
  const data = Buffer.from(`${keyword}\0${text}`, "latin1");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  return Buffer.concat([png.subarray(0, png.length - 12), chunk, png.subarray(png.length - 12)]);
}

function validateRuntimeDependencies() {
  const { Jimp } = getJimp();
  getCloudBaseSdk();
  getAiArtSdk();
  require("ws");
  return {
    node: process.version,
    jimp: typeof Jimp.read === "function" ? "loaded" : "invalid",
    ws: "loaded",
  };
}

module.exports = {
  DEFAULT_ANALYSIS,
  addPngTextChunk,
  analyzeSource,
  buildMoodPrompt,
  buildMoodSheetPrompt,
  generateMood,
  generateMoodSheet,
  generateCloudBaseImage,
  generateCloudBaseSheetImage,
  generateCloudBaseFunctionImage,
  generateAiArtImage,
  generateAiArtSheetImage,
  generateReferencedMoodSheet,
  normalizeAnalysis,
  normalizeSprite,
  parseImageGenerationFunctionResult,
  pollTextToImageJob,
  splitMoodSheet,
  validateRuntimeDependencies,
};
