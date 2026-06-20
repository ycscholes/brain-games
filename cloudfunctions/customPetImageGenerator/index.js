const tcb = require("@cloudbase/node-sdk");

const IMAGE_MODEL_NAME = "hunyuan-image";

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
  const model = options.model || app.ai().createImageModel(IMAGE_MODEL_NAME);
  const response = await model.generateImage({
    model: IMAGE_MODEL_NAME,
    prompt,
    negative_prompt: "多人，多只动物，场景，地面，阴影，文字，边框，水印，裁切，模糊，畸形",
    size: "1024x1024",
    version: "v1.9",
    revise: true,
    n: 1,
  });
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
    return await generateImage(prompt);
  } catch (error) {
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error),
    };
  }
};

exports.generateImage = generateImage;
exports.getImageUrl = getImageUrl;
