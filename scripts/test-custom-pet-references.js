#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  buildMoodSheetPrompt,
  generateReferencedMoodSheet,
  normalizeSprite,
  splitMoodSheet,
} = require("../cloudfunctions/shared/customPetGenerator");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_POSE_REFERENCE = path.join(
  REPO_ROOT,
  "asset-backups/cloudbase-images/pets/pose-reference-sheet.png",
);
const DEFAULT_USER_REFERENCE = path.join(
  REPO_ROOT,
  "scripts/fixtures/custom-pet-user-reference-dog.jpg",
);
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, "tmp/custom-pet-reference-test");
const MOODS = ["idle", "feed", "cuddle", "hungry"];

function parseArgs(argv) {
  const options = {
    live: false,
    outputDir: DEFAULT_OUTPUT_DIR,
    poseSheet: DEFAULT_POSE_REFERENCE,
    speciesLabel: "",
    userImage: process.env.CUSTOM_PET_TEST_USER_IMAGE || DEFAULT_USER_REFERENCE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--live") {
      options.live = true;
    } else if (arg === "--user-image") {
      options.userImage = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--pose-sheet" || arg === "--cat-sheet") {
      options.poseSheet = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--output-dir") {
      options.outputDir = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--species-label") {
      options.speciesLabel = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/test-custom-pet-references.js [--live] [options]

Options:
  --user-image <path>     User reference image. Defaults to scripts/fixtures/custom-pet-user-reference-dog.jpg.
  --pose-sheet <path>     Neutral 2x2 pose reference sheet. Defaults to asset-backups/cloudbase-images/pets/pose-reference-sheet.png.
  --output-dir <path>     Output directory. Defaults to tmp/custom-pet-reference-test.
  --species-label <text>  Compatibility label kept out of the generation prompt.
  --live                  Call Tencent AIArt. Without this flag the script verifies payload wiring with a mock client.
`);
}

function readRequiredFile(filePath, label) {
  if (!filePath) {
    throw new Error(`${label} path is required`);
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} not found: ${resolved}`);
  }
  return {
    buffer: fs.readFileSync(resolved),
    path: resolved,
  };
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function writeBuffer(filePath, buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runMockReferenceTest({
  outputDir,
  poseReferenceBuffer,
  speciesLabel,
  userReferenceBuffer,
}) {
  const calls = {
    query: [],
    submit: [],
  };
  const client = {
    SubmitTextToImageJob: async (payload) => {
      calls.submit.push(payload);
      return { JobId: "mock-job-1" };
    },
    QueryTextToImageJob: async (payload) => {
      calls.query.push(payload);
      return {
        JobStatusCode: "5",
        ResultImage: ["mock://custom-pet-reference-sheet.png"],
      };
    },
  };

  const generatedSheet = await generateReferencedMoodSheet({
    client,
    downloadImage: async (url) => {
      assert(url === "mock://custom-pet-reference-sheet.png", "mock download URL mismatch");
      return poseReferenceBuffer;
    },
    poseReferenceBuffer,
    sleepFn: async () => {},
    speciesLabel,
    traits: {
      primaryColor: "按第 1 张用户照片保留主色",
      secondaryColor: "按第 1 张用户照片保留辅色",
      markings: "按第 1 张用户照片保留纹理分布",
      bodyShape: "按第 1 张用户照片保留体型轮廓",
      accessories: "按第 1 张用户照片保留原有配饰",
    },
    userReferenceBuffer,
  });

  const submitPayload = calls.submit[0];
  assert(calls.submit.length === 1, "SubmitTextToImageJob should be called once");
  assert(calls.query.length === 1, "QueryTextToImageJob should be called once");
  assert(Array.isArray(submitPayload.Images), "SubmitTextToImageJob Images must be an array");
  assert(submitPayload.Images.length === 2, "SubmitTextToImageJob must receive exactly two reference images");
  assert(
    submitPayload.Images[0] === userReferenceBuffer.toString("base64"),
    "first reference image must be the user reference image",
  );
  assert(
    submitPayload.Images[1] === poseReferenceBuffer.toString("base64"),
    "second reference image must be the neutral pose reference sheet",
  );
  assert(submitPayload.Prompt.includes("2x2"), "prompt must request a 2x2 mood sheet");
  assert(
    submitPayload.Prompt.includes("第 1 张用户上传图是唯一宠物身份和外观来源，最高优先级"),
    "prompt must assign highest-priority identity to user image",
  );
  assert(
    submitPayload.Prompt.includes("物种、脸型、耳朵、眼睛、嘴吻、身体比例、毛色、花纹分布、尾巴和原有配饰"),
    "prompt must preserve all core appearance traits from the user image",
  );
  assert(
    submitPayload.Prompt.includes("第 2 张灰色无物种姿态图仅参考"),
    "prompt must treat the pose sheet as a pose template only",
  );
  assert(
    submitPayload.Prompt.includes("禁止参考第 2 张的任何外观特征"),
    "prompt must forbid all appearance traits from the second reference",
  );
  assert(submitPayload.Prompt.includes("不得变成其它动物"), "prompt must forbid other-animal drift");
  assert(submitPayload.Prompt.includes("不出现食物或食盆"), "prompt must forbid food and bowls");
  assert(submitPayload.Prompt.includes("不出现爱心、抱枕或玩具"), "prompt must forbid cuddle props");
  assert(
    submitPayload.Prompt.includes("两张图冲突时始终以第 1 张为准"),
    "prompt must resolve reference conflicts to the first image",
  );
  assert(
    submitPayload.Prompt.includes("角色身份一致性优先于姿态一致性"),
    "prompt must prioritize identity consistency over pose consistency",
  );
  assert(submitPayload.Prompt.includes("只调整姿态和表情"), "prompt must only adjust pose and expression");
  assert(!/柴犬|小狗|狗|小猫/.test(submitPayload.Prompt), "prompt must not contain user-derived animal labels");
  assert(!/人手|抚摸/.test(submitPayload.Prompt), "prompt must avoid interaction wording");
  assert(submitPayload.Prompt.includes("左上 idle"), "prompt must include the idle frame position");
  assert(submitPayload.Prompt.includes("右上 feed"), "prompt must include the feed frame position");
  assert(submitPayload.Prompt.includes("左下 cuddle"), "prompt must include the cuddle frame position");
  assert(submitPayload.Prompt.includes("右下 hungry"), "prompt must include the hungry frame position");

  const report = {
    mode: "mock",
    ok: true,
    generatedSheetBytes: generatedSheet.length,
    generatedSheetSha256: sha256(generatedSheet),
    imageCount: submitPayload.Images.length,
    imageOrder: ["user-reference-image", "neutral-pose-reference-sheet"],
    poseReferenceBytes: poseReferenceBuffer.length,
    poseReferenceSha256: sha256(poseReferenceBuffer),
    promptPreview: submitPayload.Prompt,
    resolution: submitPayload.Resolution,
    userReferenceBytes: userReferenceBuffer.length,
    userReferenceSha256: sha256(userReferenceBuffer),
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "mock-reference-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function runLiveReferenceTest({
  outputDir,
  poseReferenceBuffer,
  speciesLabel,
  userReferenceBuffer,
}) {
  const traits = {
    primaryColor: "参考第 1 张用户照片的主色",
    secondaryColor: "参考第 1 张用户照片的辅色",
    markings: "参考第 1 张用户照片的纹理分布",
    bodyShape: "参考第 1 张用户照片的体型轮廓",
    accessories: "参考第 1 张用户照片的原有配饰",
  };
  const generatedSheet = await generateReferencedMoodSheet({
    poseReferenceBuffer,
    speciesLabel,
    traits,
    userReferenceBuffer,
  });
  const sheetPath = path.join(outputDir, "generated-reference-sheet.png");
  writeBuffer(sheetPath, generatedSheet);

  const split = await splitMoodSheet({ inputBuffer: generatedSheet });
  const moodFiles = {};
  for (const mood of MOODS) {
    const normalized = await normalizeSprite({ inputBuffer: split[mood] });
    const filePath = path.join(outputDir, `${mood}.png`);
    writeBuffer(filePath, normalized);
    moodFiles[mood] = {
      bytes: normalized.length,
      path: filePath,
      sha256: sha256(normalized),
    };
  }

  const report = {
    mode: "live",
    ok: true,
    generatedSheetBytes: generatedSheet.length,
    generatedSheetPath: sheetPath,
    generatedSheetSha256: sha256(generatedSheet),
    imageOrder: ["user-reference-image", "neutral-pose-reference-sheet"],
    moodFiles,
    poseReferenceBytes: poseReferenceBuffer.length,
    poseReferenceSha256: sha256(poseReferenceBuffer),
    promptPreview: buildMoodSheetPrompt({ speciesLabel, traits, includeReferenceRoles: true }),
    userReferenceBytes: userReferenceBuffer.length,
    userReferenceSha256: sha256(userReferenceBuffer),
  };
  fs.writeFileSync(path.join(outputDir, "live-reference-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const userReference = readRequiredFile(options.userImage, "User reference image");
  const poseReference = readRequiredFile(options.poseSheet, "Neutral pose reference sheet");
  fs.mkdirSync(options.outputDir, { recursive: true });

  const report = options.live
    ? await runLiveReferenceTest({
        outputDir: path.resolve(options.outputDir),
        poseReferenceBuffer: poseReference.buffer,
        speciesLabel: options.speciesLabel,
        userReferenceBuffer: userReference.buffer,
      })
    : await runMockReferenceTest({
        outputDir: path.resolve(options.outputDir),
        poseReferenceBuffer: poseReference.buffer,
        speciesLabel: options.speciesLabel,
        userReferenceBuffer: userReference.buffer,
      });

  console.log(JSON.stringify({
    ok: true,
    mode: report.mode,
    outputDir: path.resolve(options.outputDir),
    poseReferencePath: poseReference.path,
    userReferencePath: userReference.path,
    imageOrder: report.imageOrder,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
