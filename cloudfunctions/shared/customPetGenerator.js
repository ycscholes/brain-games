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

function getWxServerSdk() {
  return require("wx-server-sdk");
}

const CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME = "hunyuan-image";
const CLOUD_BASE_IMAGE_MODEL_NAME = "HY-Image-3.0-Plus-4090-Tob-v1.0";
const DEFAULT_IMAGE_GENERATION_FUNCTION_NAME = "customPetImageGenerator";

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

function logTextPrompt({ provider, operation, messages }) {
  console.info(
    "[custom-pet-generator] text prompt",
    JSON.stringify({
      event: "custom_pet_text_prompt",
      provider,
      operation,
      messages,
    }),
  );
}

async function analyzeSource({ sourceBuffer, mimeType = "image/jpeg", app }) {
  try {
    const tcb = getCloudBaseSdk();
    const cloudApp = app || tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
    const model = cloudApp.ai().createModel("hunyuan-exp");
    const textPromptMessages = [
      {
        role: "system",
        content:
          "你是宠物参考图分析器。只输出 JSON，不要解释。speciesLabel 必须来自用户上传图的真实可见外观；mappedSkin 只是前端兼容分类，只能是 cat,dog,rabbit,bear,panda,gecko,turtle，不得作为生成物种或外观依据。",
      },
      {
        role: "user",
        content:
          "根据用户上传的单只宠物参考图输出 speciesLabel、mappedSkin、traits。traits 包含 primaryColor、secondaryColor、markings、bodyShape、accessories，必须直接描述参考图可见特征，不要套用 mappedSkin 的默认外观。",
      },
    ];
    logTextPrompt({
      provider: "cloudbase-text",
      operation: "analyzeSource",
      messages: textPromptMessages,
    });
    const result = await model.generateText({
      model: "hunyuan-2.0-instruct-20251111",
      messages: [
        textPromptMessages[0],
        {
          role: "user",
          content: [
            {
              type: "text",
              text: textPromptMessages[1].content,
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
  "视觉特征：严格使用上传图分析得到的主色、辅色、纹理分布、体型轮廓、脸部轮廓和原有配饰";
const EXTRA_CONTENT_NEGATIVE_PROMPT =
  "每格只保留宠物本体及原有配饰，禁止出现其它角色、互动肢体、餐饮元素、器皿、玩具、特效、光环、场景物件";
const IMAGE_NEGATIVE_PROMPT =
  "多人，多只动物，场景，地面，阴影，文字，边框，水印，裁切，模糊，畸形";
const FOOTNOTE_REGION_WIDTH_RATIO = 0.28;
const FOOTNOTE_REGION_HEIGHT_RATIO = 0.16;
const NORMALIZED_FOOTNOTE_REGION_WIDTH_RATIO = 0.3;
const NORMALIZED_FOOTNOTE_REGION_HEIGHT_RATIO = 0.13;

function logImagePrompt({ provider, operation, prompt, negativePrompt = null, references = null }) {
  const payload = {
    event: "custom_pet_image_prompt",
    provider,
    operation,
    prompt,
  };
  if (negativePrompt) {
    payload.negativePrompt = negativePrompt;
  }
  if (references) {
    payload.references = references;
  }
  console.info("[custom-pet-generator] image prompt", JSON.stringify(payload));
}

function describeCustomPet({ speciesLabel, traits = {} }) {
  return [
    speciesLabel ? `物种外观：${String(speciesLabel).slice(0, 30)}` : "",
    traits.primaryColor ? `主色：${String(traits.primaryColor).slice(0, 40)}` : "",
    traits.secondaryColor ? `辅色：${String(traits.secondaryColor).slice(0, 40)}` : "",
    traits.markings ? `花纹：${String(traits.markings).slice(0, 60)}` : "",
    traits.bodyShape ? `体型：${String(traits.bodyShape).slice(0, 60)}` : "",
    traits.accessories ? `配饰：${String(traits.accessories).slice(0, 60)}` : "",
  ].filter(Boolean).join("；");
}

function buildMoodPrompt({ mood, speciesLabel, traits }) {
  const moodText = {
    idle: "自然站立或坐着，平静看向前方",
    feed: "保持参考状态的愉快表情和身体姿态，嘴部可有轻微动作",
    cuddle: "亲昵地靠近并露出放松享受的表情",
    hungry: "略显饥饿和期待，姿态仍然可爱，不要悲惨",
  }[mood];
  const identity = describeCustomPet({ speciesLabel, traits });
  return [
    `单只用户上传图分析得到的宠物全身角色，${moodText}`,
    identity,
    "固定水彩绘本风格，儿童友好，轮廓清楚，主体居中",
    "纯亮绿色背景 #00FF00，无场景、无地面、无投影、无边框、无文字",
    REFERENCE_VISUAL_TRAITS_PROMPT,
    EXTRA_CONTENT_NEGATIVE_PROMPT,
    "保留上传图分析得到的身份和外观",
  ].join("。").slice(0, 250);
}

function buildMoodSheetPrompt({ speciesLabel, traits }) {
  // This prompt is part of the runtime contract with splitMoodSheet(): it must
  // keep a deterministic 2x2 layout so the worker can crop by coordinates and
  // still publish the existing four mood files expected by the mini program.
  const identity = describeCustomPet({ speciesLabel, traits });
  return [
    "必须生成一张用户上传图分析得到的同一只宠物 2x2 四宫格角色设定图，不是单张宠物画像",
    "画布平均分成四个等大格子，每格只放同一只宠物的一个完整状态，宠物不能跨越格子",
    "最终结果必须明显是 2x2 四宫格，后续会按四宫格坐标裁切",
    identity,
    "左上 idle：同一只宠物自然站立或坐着，平静看向前方",
    "右上 feed：同一只宠物开心表情，仅允许嘴部轻微动作，不出现食物或食盆",
    "左下 cuddle：同一只宠物亲昵放松表情，不出现爱心、抱枕或玩具",
    "右下 hungry：同一只宠物期待姿态和可爱表情，不要悲伤",
    "四格必须一眼认出是同一只宠物，物种、脸型、耳朵、眼睛、嘴吻、身体比例、毛色、花纹、尾巴和原有配饰完全一致",
    "纯亮绿色背景 #00FF00，无场景、无地面、无投影、无边框、无文字、无标签",
    REFERENCE_VISUAL_TRAITS_PROMPT,
    `${EXTRA_CONTENT_NEGATIVE_PROMPT}，尤其禁止食物、食盆、爱心、抱枕、玩具和特效`,
    "儿童绘本水彩风格，主体居中，只调整姿态和表情",
  ].filter(Boolean).join("。").slice(0, 900);
}

function configureCloudBaseImageModel(model) {
  if (!model) {
    return model;
  }
  if (!model.generateImageSubUrlConfig) {
    model.generateImageSubUrlConfig = {};
  }
  if (!model.generateImageSubUrlConfig[CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME]) {
    model.generateImageSubUrlConfig[CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME] = {};
  }
  model.generateImageSubUrlConfig[CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME][CLOUD_BASE_IMAGE_MODEL_NAME] =
    "images/ar/generations";
  return model;
}

function createCloudBaseImageModel(app) {
  const tcb = getCloudBaseSdk();
  const cloudApp = app || tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
  return configureCloudBaseImageModel(cloudApp.ai().createImageModel(CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME));
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

async function generateCloudBaseImage({
  mood,
  traits,
  speciesLabel,
  imageModel,
  downloadImage,
  referenceImageUrl,
  poseImageUrl,
}) {
  const prompt = buildMoodPrompt({ mood, traits, speciesLabel });
  if (!imageModel) {
    // In wx-server-sdk cloud functions the shared generator cannot always init
    // CloudBase AI directly, so production can route through the image helper function.
    return generateCloudBaseFunctionImage({
      prompt,
      downloadImage,
      referenceImageUrl,
      poseImageUrl,
    });
  }
  return generateCloudBaseSdkImage({
    prompt,
    imageModel,
    downloadImage,
    referenceImageUrl,
    poseImageUrl,
  });
}

async function generateCloudBaseSheetImage({
  traits,
  speciesLabel,
  imageModel,
  downloadImage,
  referenceImageUrl,
  poseImageUrl,
}) {
  const prompt = buildMoodSheetPrompt({ traits, speciesLabel });
  if (!imageModel) {
    // Same transport as single-mood CloudBase generation, but the prompt asks for
    // all states in one sheet so the worker can split locally.
    return generateCloudBaseFunctionImage({
      prompt,
      downloadImage,
      referenceImageUrl,
      poseImageUrl,
    });
  }
  return generateCloudBaseSdkImage({
    prompt,
    imageModel,
    downloadImage,
    referenceImageUrl,
    poseImageUrl,
  });
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

async function generateCloudBaseFunctionImage({
  prompt,
  cloudFunction,
  downloadImage,
  referenceImageUrl,
  poseImageUrl,
}) {
  const caller =
    cloudFunction ||
    ((params) => {
      const cloud = getWxServerSdk();
      return cloud.callFunction(params);
    });
  const functionName =
    process.env.CUSTOM_PET_IMAGE_FUNCTION_NAME || DEFAULT_IMAGE_GENERATION_FUNCTION_NAME;
  logImagePrompt({
    provider: "cloudbase-function",
    operation: functionName,
    prompt,
    negativePrompt: IMAGE_NEGATIVE_PROMPT,
    references: {
      referenceImage: Boolean(referenceImageUrl),
      poseImage: Boolean(poseImageUrl),
    },
  });
  const response = await caller({
    name: functionName,
    data: {
      prompt,
      referenceImageUrl,
      poseImageUrl,
    },
  });
  const { imageUrl } = parseImageGenerationFunctionResult(response);
  return (downloadImage || downloadRemoteImage)(imageUrl);
}

async function generateCloudBaseSdkImage({
  prompt,
  imageModel,
  downloadImage,
  referenceImageUrl,
  poseImageUrl,
}) {
  const model = configureCloudBaseImageModel(imageModel || createCloudBaseImageModel());
  logImagePrompt({
    provider: "cloudbase-sdk",
    operation: "generateImage",
    prompt,
    negativePrompt: IMAGE_NEGATIVE_PROMPT,
    references: {
      referenceImage: Boolean(referenceImageUrl),
      poseImage: Boolean(poseImageUrl),
    },
  });
  const request = {
    model: CLOUD_BASE_IMAGE_MODEL_NAME,
    prompt,
    size: "1024x1024",
    footnote: "",
    revise: { value: false },
    enable_thinking: { value: false },
  };
  if (referenceImageUrl) {
    request.image_url = referenceImageUrl;
  }
  if (poseImageUrl) {
    request.pose_image_url = poseImageUrl;
  }
  const response = await model.generateImage(request);
  const url = response && response.data && response.data[0] && response.data[0].url;
  if (!url) {
    throw new Error("CloudBase image response is empty");
  }
  return (downloadImage || downloadRemoteImage)(url);
}

async function generateMood({
  mood,
  traits,
  speciesLabel,
  client,
  referenceImageUrl,
  poseImageUrl,
}) {
  return generateCloudBaseImage({
    mood,
    traits,
    speciesLabel,
    imageModel: client,
    referenceImageUrl,
    poseImageUrl,
  });
}

async function generateMoodSheet({
  traits,
  speciesLabel,
  client,
  referenceImageUrl,
  poseImageUrl,
}) {
  return generateCloudBaseSheetImage({
    traits,
    speciesLabel,
    imageModel: client,
    referenceImageUrl,
    poseImageUrl,
  });
}

async function splitMoodSheet({ inputBuffer }) {
  const { Jimp, JimpMime } = getJimp();
  const image = await Jimp.read(inputBuffer);
  removeGeneratedSheetFootnote(image);
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

function removeGeneratedSheetFootnote(image) {
  const bitmap = image && image.bitmap;
  if (!bitmap || !bitmap.data || !bitmap.width || !bitmap.height) {
    return image;
  }
  const startX = Math.floor(bitmap.width * (1 - FOOTNOTE_REGION_WIDTH_RATIO));
  const startY = Math.floor(bitmap.height * (1 - FOOTNOTE_REGION_HEIGHT_RATIO));
  for (let y = startY; y < bitmap.height; y += 1) {
    for (let x = startX; x < bitmap.width; x += 1) {
      const offset = (bitmap.width * y + x) * 4;
      const red = bitmap.data[offset];
      const green = bitmap.data[offset + 1];
      const blue = bitmap.data[offset + 2];
      const alpha = bitmap.data[offset + 3];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max - min;
      if (alpha > 0 && max < 210 && min > 25 && saturation < 70) {
        bitmap.data[offset] = 0;
        bitmap.data[offset + 1] = 255;
        bitmap.data[offset + 2] = 0;
        bitmap.data[offset + 3] = 255;
      }
    }
  }
  return image;
}

function removeNormalizedFootnote(image) {
  const bitmap = image && image.bitmap;
  if (!bitmap || !bitmap.data || !bitmap.width || !bitmap.height) {
    return image;
  }
  const startX = Math.floor(bitmap.width * (1 - NORMALIZED_FOOTNOTE_REGION_WIDTH_RATIO));
  const startY = Math.floor(bitmap.height * (1 - NORMALIZED_FOOTNOTE_REGION_HEIGHT_RATIO));
  const hardClearX = Math.floor(bitmap.width * 0.72);
  const hardClearY = Math.floor(bitmap.height * 0.88);
  const textRegionX = Math.floor(bitmap.width * 0.5);
  const textRegionY = Math.floor(bitmap.height * 0.78);
  const repairMask = new Set();
  for (let y = Math.min(startY, textRegionY); y < bitmap.height; y += 1) {
    for (let x = Math.min(startX, textRegionX); x < bitmap.width; x += 1) {
      const offset = (bitmap.width * y + x) * 4;
      if (x >= hardClearX && y >= hardClearY) {
        bitmap.data[offset + 3] = 0;
        continue;
      }
      const red = bitmap.data[offset];
      const green = bitmap.data[offset + 1];
      const blue = bitmap.data[offset + 2];
      const alpha = bitmap.data[offset + 3];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max - min;
      if (
        alpha > 0 &&
        ((x >= hardClearX && y >= hardClearY) ||
          (x >= textRegionX && y >= textRegionY && max < 210 && saturation < 150))
      ) {
        repairMask.add(`${x},${y}`);
      }
    }
  }
  for (const key of repairMask) {
    const [x, y] = key.split(",").map(Number);
    const offset = (bitmap.width * y + x) * 4;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let alphaSum = 0;
    let count = 0;
    const radius = 10;
    for (let dy = -radius; dy <= radius; dy += 1) {
      const sampleY = y + dy;
      if (sampleY < 0 || sampleY >= bitmap.height) {
        continue;
      }
      for (let dx = -radius; dx <= radius; dx += 1) {
        const sampleX = x + dx;
        if (sampleX < 0 || sampleX >= bitmap.width || repairMask.has(`${sampleX},${sampleY}`)) {
          continue;
        }
        const sampleOffset = (bitmap.width * sampleY + sampleX) * 4;
        const sampleAlpha = bitmap.data[sampleOffset + 3];
        if (sampleAlpha === 0) {
          continue;
        }
        redSum += bitmap.data[sampleOffset];
        greenSum += bitmap.data[sampleOffset + 1];
        blueSum += bitmap.data[sampleOffset + 2];
        alphaSum += sampleAlpha;
        count += 1;
      }
    }
    if (count > 0) {
      bitmap.data[offset] = Math.round(redSum / count);
      bitmap.data[offset + 1] = Math.round(greenSum / count);
      bitmap.data[offset + 2] = Math.round(blueSum / count);
      bitmap.data[offset + 3] = Math.round(alphaSum / count);
    } else {
      bitmap.data[offset + 3] = 0;
    }
  }
  return image;
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
  removeNormalizedFootnote(canvas);
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
  CLOUD_BASE_IMAGE_MODEL_CLIENT_NAME,
  CLOUD_BASE_IMAGE_MODEL_NAME,
  IMAGE_NEGATIVE_PROMPT,
  generateMood,
  generateMoodSheet,
  generateCloudBaseImage,
  generateCloudBaseSheetImage,
  generateCloudBaseFunctionImage,
  normalizeAnalysis,
  normalizeSprite,
  parseImageGenerationFunctionResult,
  removeGeneratedSheetFootnote,
  removeNormalizedFootnote,
  splitMoodSheet,
  validateRuntimeDependencies,
};
