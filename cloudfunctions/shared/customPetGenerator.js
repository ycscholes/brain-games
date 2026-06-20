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

function buildMoodPrompt({ mood, traits, speciesLabel }) {
  const moodText = {
    idle: "自然站立或坐着，平静看向前方",
    feed: "开心进食，嘴边有轻微咀嚼动作，但不要出现具体食物",
    cuddle: "亲昵地靠近并露出享受抚摸的表情",
    hungry: "略显饥饿和期待，姿态仍然可爱，不要悲惨",
  }[mood];
  return [
    `单只${speciesLabel || "宠物"}全身角色，${moodText}`,
    "固定水彩绘本风格，儿童友好，轮廓清楚，主体居中",
    "纯亮绿色背景 #00FF00，无场景、无地面、无投影、无边框、无文字",
    `身份特征：${Object.values(traits || {}).join("；")}`,
    "保留参考图的物种、主色、花纹、体型和配饰，四周保留安全边距",
  ].join("。").slice(0, 250);
}

function createAiArtClient() {
  const aiart = getAiArtSdk();
  const Client = aiart.v20221229.Client;
  const secretId =
    process.env.TENCENTCLOUD_SECRET_ID || process.env.TENCENTCLOUD_SECRETID;
  const secretKey =
    process.env.TENCENTCLOUD_SECRET_KEY || process.env.TENCENTCLOUD_SECRETKEY;
  const token =
    process.env.TENCENTCLOUD_SESSION_TOKEN || process.env.TENCENTCLOUD_SESSIONTOKEN;
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
    region: process.env.TENCENTCLOUD_AI_REGION || "ap-guangzhou",
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

async function generateCloudBaseImage({ mood, traits, speciesLabel, imageModel, downloadImage }) {
  const prompt = buildMoodPrompt({ mood, traits, speciesLabel });
  if (!imageModel) {
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

async function generateMood({ referenceBuffer, mood, traits, speciesLabel, client }) {
  const provider = process.env.CUSTOM_PET_IMAGE_PROVIDER || "cloudbase";
  if (provider === "aiart") {
    return generateAiArtImage({ referenceBuffer, mood, traits, speciesLabel, client });
  }
  return generateCloudBaseImage({ mood, traits, speciesLabel, imageModel: client });
}

async function normalizeSprite({ inputBuffer }) {
  const { Jimp, JimpMime } = getJimp();
  const image = await Jimp.read(inputBuffer);
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
  generateMood,
  generateCloudBaseImage,
  generateCloudBaseFunctionImage,
  generateAiArtImage,
  normalizeAnalysis,
  normalizeSprite,
  parseImageGenerationFunctionResult,
  validateRuntimeDependencies,
};
