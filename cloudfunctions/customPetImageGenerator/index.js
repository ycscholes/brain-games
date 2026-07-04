const tcb = require("@cloudbase/node-sdk");

const IMAGE_MODEL_CLIENT_NAME = "hunyuan-image";
const IMAGE_MODEL_NAME = "HY-Image-3.0-Plus-4090-Tob-v1.0";
const IMAGE_GENERATION_SUB_URL = "images/ar/generations";

function configureImageModel(model) {
  if (!model.generateImageSubUrlConfig) {
    model.generateImageSubUrlConfig = {};
  }
  model.generateImageSubUrlConfig[IMAGE_MODEL_CLIENT_NAME] = [
    [new RegExp(`^${IMAGE_MODEL_NAME}$`), IMAGE_GENERATION_SUB_URL],
  ];
  model.generateImageSubUrl = IMAGE_GENERATION_SUB_URL;
  return model;
}

function getReferenceImageUrls(options = {}) {
  return [options.referenceImageUrl, options.poseImageUrl].filter(Boolean);
}

function getImageUrl(response) {
  if (response && typeof response.imageUrl === "string") {
    return response.imageUrl;
  }
  if (response && response.data && response.data[0] && typeof response.data[0].url === "string") {
    return response.data[0].url;
  }
  if (response && response.data && response.data[0] && typeof response.data[0].b64_json === "string") {
    return null;
  }
  return null;
}

function getRevisedPrompt(response) {
  if (response && typeof response.revised_prompt === "string") {
    return response.revised_prompt;
  }
  if (
    response &&
    response.data &&
    response.data[0] &&
    typeof response.data[0].revised_prompt === "string"
  ) {
    return response.data[0].revised_prompt;
  }
  return null;
}

function getErrorCode(error) {
  if (error && error.code) {
    return String(error.code);
  }
  if (error && error.response && error.response.status) {
    return String(error.response.status);
  }
  return "Error";
}

function getErrorMessage(error) {
  if (error && error.message) {
    return String(error.message).slice(0, 240);
  }
  return String(error || "unknown error").slice(0, 240);
}

async function generateImage(prompt, options = {}) {
  const app = options.app || tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
  const model = configureImageModel(options.model || app.ai().createImageModel(IMAGE_MODEL_CLIENT_NAME));
  const request = {
    model: IMAGE_MODEL_NAME,
    prompt,
    size: "1024x1024",
    footnote: "",
    revise: { value: false },
    enable_thinking: { value: false },
  };
  const imageUrls = getReferenceImageUrls(options);
  if (imageUrls.length > 0) {
    request.image_urls = imageUrls;
  }
  const response = await model.generateImage(request);
  const imageUrl = getImageUrl(response);
  if (!imageUrl) {
    throw new Error("CloudBase image response is empty");
  }
  return {
    success: true,
    imageUrl,
    revised_prompt: getRevisedPrompt(response),
    expiresIn: 24 * 60 * 60,
  };
}

exports.main = async (event = {}) => {
  const prompt = String(event.prompt || "").trim();
  if (!prompt) {
    return {
      success: false,
      code: "INVALID_PROMPT",
      message: "prompt is required",
    };
  }
  try {
    return await generateImage(prompt, {
      referenceImageUrl: event.referenceImageUrl,
      poseImageUrl: event.poseImageUrl,
    });
  } catch (error) {
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error),
    };
  }
};

exports.generateImage = generateImage;
exports.configureImageModel = configureImageModel;
exports.getReferenceImageUrls = getReferenceImageUrls;
exports.getImageUrl = getImageUrl;
