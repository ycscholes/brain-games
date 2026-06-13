# Custom AI Pet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user spend 300 pet points to generate one private, four-state custom pet from one uploaded image, reroll it once, adopt it, use it in every pet scene, and permanently delete all associated data.

**Architecture:** Extend the local pet model with a stable `PetAssetRef`, while keeping custom-pet generation state and point reservations authoritative in CloudBase. A step-based worker analyzes the source image, creates an idle identity anchor, derives the other moods, validates and stores private files, then exposes short-lived URLs only to the owner. Standard pets continue using the current public asset manifest.

**Tech Stack:** Taro 4, React 18, TypeScript, Jest, WeChat Cloud Development, CloudBase document database/storage/functions, `@cloudbase/node-sdk`, Tencent AIArt image-to-image API, Sharp.

---

## File Structure

New focused modules:

- `src/pages/pet/petAssets.ts`: standard/custom asset-reference types and helpers.
- `src/services/custom-pet/types.ts`: client-visible task and API types.
- `src/services/custom-pet/customPetService.ts`: upload, cloud-function calls, polling, URL resolution.
- `src/pages/pet/components/CustomPetFlow/index.tsx`: upload, task progress, preview, reroll, adoption and deletion UI.
- `src/pages/pet/components/CustomPetFlow/index.scss`: custom-pet flow styling.
- `cloudfunctions/customPetApi/index.js`: authenticated command/query API and transaction boundaries.
- `cloudfunctions/customPetWorker/index.js`: idempotent generation step runner.
- `cloudfunctions/customPetRecovery/index.js`: timer-triggered recovery and orphan cleanup.
- `cloudfunctions/shared/customPetDomain.js`: state machine, constants, storage paths and error mapping.
- `cloudfunctions/shared/customPetGenerator.js`: Tencent AI analysis/image adapter and PNG post-processing.
- `tests/unit/petAssets.test.ts`: asset reference behavior.
- `tests/unit/customPetService.test.ts`: client service and URL caching.
- `tests/unit/customPetDomain.test.js`: cloud task state, eligibility and settlement behavior.

Existing modules to modify:

- `src/pages/pet/types.ts`: add custom pet fields and reserved balance.
- `src/utils/petStorage.ts`: migrate custom pets and preserve server-authoritative reserved balance.
- `src/pages/pet/components/PetSprite/*`: resolve either standard or custom assets.
- `src/config/remoteAssets.ts`: generic private file-ID cache support.
- `src/pages/pet/index.tsx` and `index.scss`: expose the custom flow and delete action.
- `src/pages/index/index.tsx`: render the active pet asset reference.
- `src/pages/bird-count/gameLogic.ts` and `index.tsx`: use pet instance keys rather than only skins.
- `src/pages/memory-challenge/gameLogic.ts` and `index.tsx`: load current-user pet asset references.
- `src/services/user-data/*`: preserve custom pet fields during snapshot sync without letting snapshots settle generation transactions.
- `cloudfunctions/package.json`, `scripts/deploy-cloudfunctions.sh`, `cloudbaserc.json`: dependencies and deployment configuration.
- `docs/points-economy.md`, `src/pages/pet/README.md`: price, lifecycle and private-resource rules.

### Task 1: Add Dynamic Pet Asset Types

**Files:**
- Create: `src/pages/pet/petAssets.ts`
- Modify: `src/pages/pet/types.ts`
- Modify: `src/utils/petStorage.ts`
- Test: `tests/unit/petAssets.test.ts`
- Test: `tests/unit/petStorage.test.ts`

- [ ] **Step 1: Write failing asset and migration tests**

Cover:

```ts
expect(getPetTemplateSkin(customPet)).toBe("rabbit");
expect(getPetAssetRef(customPet)).toEqual({
  kind: "custom",
  templateSkin: "rabbit",
  customAssetId: "asset-1",
});
expect(getFoodItemsForPet(customPet)).toEqual(getFoodItemsForPetSkin("rabbit"));
```

Also load a legacy `{ skin: "cat" }` pet and assert it migrates to `assetRef: { kind: "standard", skin: "cat" }` without changing hunger or balance.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- --runTestsByPath tests/unit/petAssets.test.ts tests/unit/petStorage.test.ts
```

Expected: FAIL because dynamic asset helpers and fields do not exist.

- [ ] **Step 3: Implement types and migration**

Define:

```ts
export type PetAssetRef =
  | { kind: "standard"; skin: PetSkin }
  | { kind: "custom"; templateSkin: PetSkin; customAssetId: string };

export interface PetData {
  // existing fields
  assetRef: PetAssetRef;
}

export interface PetStorageData {
  // existing fields
  reservedBalance: number;
}
```

Keep `skin` as a normalized compatibility field equal to the standard skin or custom `templateSkin`, so existing economy and lifecycle code remains stable while rendering migrates to `assetRef`.

- [ ] **Step 4: Run focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/pet/petAssets.ts src/pages/pet/types.ts src/utils/petStorage.ts tests/unit/petAssets.test.ts tests/unit/petStorage.test.ts
git commit -m "feat: add dynamic pet asset references"
```

### Task 2: Implement Custom Pet Domain State Machine

**Files:**
- Create: `cloudfunctions/shared/customPetDomain.js`
- Create: `tests/unit/customPetDomain.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing domain tests**

Test constants and pure transitions:

```js
expect(CUSTOM_PET_PRICE).toBe(300);
expect(canTransition("uploaded", "analyzing")).toBe(true);
expect(canTransition("preview_ready", "adopted")).toBe(true);
expect(canTransition("failed", "adopted")).toBe(false);
expect(getNextWorkerStep("generating_idle")).toBe("generating_variants");
```

Test that preview readiness consumes the one-time generation slot, technical failure does not, cancellation after preview does not restore it, and reroll can be claimed once.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- --runTestsByPath tests/unit/customPetDomain.test.js
```

Expected: FAIL because the domain module does not exist.

- [ ] **Step 3: Implement the pure domain module**

Export:

```js
const CUSTOM_PET_PRICE = 300;
const MAX_REROLLS = 1;
const MAX_STEP_ATTEMPTS = 3;
const ACTIVE_STATUSES = new Set([
  "uploaded",
  "analyzing",
  "generating_idle",
  "generating_variants",
  "validating",
  "rerolling",
]);
```

Include legal transitions, owner storage path builders, retry classification and task sanitization for client responses.

- [ ] **Step 4: Run focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/shared/customPetDomain.js tests/unit/customPetDomain.test.js package.json
git commit -m "feat: define custom pet task lifecycle"
```

### Task 3: Add Cloud API and Point Transactions

**Files:**
- Create: `cloudfunctions/customPetApi/index.js`
- Modify: `cloudfunctions/package.json`
- Modify: `cloudfunctions/syncUserData/index.js`
- Modify: `cloudfunctions/getUserData/index.js`
- Modify: `scripts/deploy-cloudfunctions.sh`
- Create: `cloudbaserc.json`
- Test: `tests/unit/customPetDomain.test.js`

- [ ] **Step 1: Add failing transaction-service tests**

Mock the database transaction adapter and cover:

- `createUploadIntent`: rejects used eligibility, active task or available balance below 300.
- `submit`: reserves exactly 300 and creates one task.
- `markPreviewReady`: writes the irreversible eligibility tombstone.
- `adopt`: creates one custom pet and converts reserved points to spent points.
- duplicate `adopt`: returns the existing pet without a second deduction.
- `cancel`: releases reservation but preserves eligibility.
- `delete`: records a deletion job and preserves eligibility.

- [ ] **Step 2: Run tests and verify failure**

Expected: FAIL for missing API handlers.

- [ ] **Step 3: Implement one authenticated command API**

Dispatch on `event.action`:

```js
const ACTIONS = {
  CREATE_UPLOAD_INTENT: "createUploadIntent",
  SUBMIT: "submit",
  GET_STATUS: "getStatus",
  REROLL: "reroll",
  ADOPT: "adopt",
  CANCEL: "cancel",
  DELETE: "delete",
  GET_ASSET_URLS: "getAssetUrls",
};
```

Use server-side transactions for all balance/task/eligibility changes. Store custom task documents in `custom_pet_jobs`, eligibility in `custom_pet_entitlements`, and custom asset metadata in `custom_pet_assets`.

- [ ] **Step 4: Protect snapshot synchronization**

Cloud snapshots may update lifecycle fields but must not overwrite `reservedBalance`, custom generation entitlement or server task records. Normalize snapshots on the server and keep the collection name consistent between `getUserData` and `syncUserData`.

- [ ] **Step 5: Configure deployment**

Add `customPetApi`, `customPetWorker`, and `customPetRecovery` to deployment scripts. Configure Worker timeout to 900 seconds and an every-five-minutes timer trigger for recovery.

- [ ] **Step 6: Run cloud-domain tests and secret checks**

```bash
npm test -- --runTestsByPath tests/unit/customPetDomain.test.js
npm run secrets:check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudfunctions/customPetApi cloudfunctions/shared cloudfunctions/package.json cloudfunctions/syncUserData cloudfunctions/getUserData scripts/deploy-cloudfunctions.sh cloudbaserc.json tests/unit/customPetDomain.test.js
git commit -m "feat: add custom pet cloud transactions"
```

### Task 4: Implement the AI Generation Worker

**Files:**
- Create: `cloudfunctions/shared/customPetGenerator.js`
- Create: `cloudfunctions/customPetWorker/index.js`
- Create: `cloudfunctions/customPetRecovery/index.js`
- Modify: `cloudfunctions/package.json`
- Test: `tests/unit/customPetDomain.test.js`

- [ ] **Step 1: Add failing adapter and retry tests**

Use dependency injection to assert:

- analysis returns one of seven `mappedSkin` values plus structured traits;
- `idle` uses the source image;
- variants use the accepted idle file as the reference image;
- a failed variant retries only that mood;
- identity-anchor replacement invalidates previous variants;
- generated provider URLs are copied immediately because provider URLs expire;
- final output metadata includes the AI marker.

- [ ] **Step 2: Run tests and verify failure**

Expected: FAIL for missing generator/worker exports.

- [ ] **Step 3: Implement analysis and image adapters**

Use `@cloudbase/node-sdk` multimodal analysis for structured traits and Tencent AIArt `ImageToImage` for generation. Hide provider details behind:

```js
async function analyzeSource({ sourceBuffer, mimeType }) {}
async function generateMood({ referenceUrl, mood, traits, mappedSkin, seed }) {}
async function normalizeSprite({ inputBuffer, aiMetadata }) {}
```

`normalizeSprite` writes a square RGBA PNG, removes the generated flat chroma-key background with Sharp, trims transparent overflow, restores safe padding and writes AI metadata.

- [ ] **Step 4: Implement idempotent worker steps**

Acquire a versioned lease, run one step, upload to a deterministic private path, then advance status with compare-and-set semantics. Classify provider moderation as terminal, provider timeout/rate-limit as retryable and quality validation as a mood-local retry.

- [ ] **Step 5: Implement recovery**

The timer function finds expired leases, retryable failed steps and deletion jobs. It resumes tasks without creating a second asset version and removes orphaned upload intents older than one day.

- [ ] **Step 6: Run focused tests**

Expected: PASS with all provider calls mocked.

- [ ] **Step 7: Commit**

```bash
git add cloudfunctions/shared/customPetGenerator.js cloudfunctions/customPetWorker cloudfunctions/customPetRecovery cloudfunctions/package.json tests/unit/customPetDomain.test.js
git commit -m "feat: generate private custom pet sprites"
```

### Task 5: Add the Client Custom Pet Service

**Files:**
- Create: `src/services/custom-pet/types.ts`
- Create: `src/services/custom-pet/customPetService.ts`
- Modify: `src/services/user-data/cloud/cloudFunctionsClient.ts`
- Modify: `src/config/remoteAssets.ts`
- Test: `tests/unit/customPetService.test.ts`
- Test: `tests/unit/remoteAssets.test.ts`

- [ ] **Step 1: Write failing client tests**

Cover upload intent, private upload, task polling, action calls, owner-only URL batches, signed URL expiry caching and forced refresh after image failure.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- --runTestsByPath tests/unit/customPetService.test.ts tests/unit/remoteAssets.test.ts
```

- [ ] **Step 3: Implement API wrappers**

Expose:

```ts
createCustomPetUploadIntent()
submitCustomPet(sourceFileId: string)
getCustomPetTask()
rerollCustomPet(jobId: string)
adoptCustomPet(jobId: string, name: string)
cancelCustomPet(jobId: string)
deleteCustomPet(petId: string)
resolveCustomPetMoodUrl(assetId: string, mood: PetSpriteMood, options?)
```

Use `wx.cloud.uploadFile` for the private source and `customPetApi` for all authoritative state changes.

- [ ] **Step 4: Implement generic private URL cache**

Reuse the existing signed URL expiry logic but key custom assets by `fileID`; never mark a custom file URL permanent, even when public remote assets are enabled.

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/custom-pet src/services/user-data/cloud/cloudFunctionsClient.ts src/config/remoteAssets.ts tests/unit/customPetService.test.ts tests/unit/remoteAssets.test.ts
git commit -m "feat: add custom pet client service"
```

### Task 6: Make PetSprite Render Dynamic Assets

**Files:**
- Modify: `src/pages/pet/components/PetSprite/types.ts`
- Modify: `src/pages/pet/components/PetSprite/index.tsx`
- Modify: `src/pages/pet/petAssets.ts`
- Test: `tests/unit/petAssets.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Assert standard references call the public resolver and custom references call `resolveCustomPetMoodUrl`.

- [ ] **Step 2: Run tests and verify failure**

- [ ] **Step 3: Update PetSprite**

Replace `skin` with:

```ts
assetRef: PetAssetRef;
```

Retain a temporary optional `skin` compatibility prop only while callers are migrated. Reset retries when either asset ID or mood changes, keep stable dimensions, and do not use local-image or emoji fallbacks.

- [ ] **Step 4: Migrate direct pet-page and home callers**

Pass `getPetAssetRef(pet)` for existing pet instances and `createStandardPetAssetRef(skin)` for adoption previews.

- [ ] **Step 5: Run typecheck and focused tests**

```bash
npm run typecheck
npm test -- --runTestsByPath tests/unit/petAssets.test.ts tests/unit/remoteAssets.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/pet/components/PetSprite src/pages/pet/petAssets.ts src/pages/pet/index.tsx src/pages/index/index.tsx tests/unit/petAssets.test.ts
git commit -m "feat: render private custom pet assets"
```

### Task 7: Build the Upload, Progress and Preview Flow

**Files:**
- Create: `src/pages/pet/components/CustomPetFlow/index.tsx`
- Create: `src/pages/pet/components/CustomPetFlow/index.scss`
- Modify: `src/pages/pet/index.tsx`
- Modify: `src/pages/pet/index.scss`
- Modify: `src/pages/settings/index.tsx`

- [ ] **Step 1: Add the custom adoption mode**

Provide a segmented choice between standard adoption and AI custom adoption. The custom flow shows price, one-pet limit, reroll count, private storage and long-term source retention before image selection.

- [ ] **Step 2: Implement image selection and upload**

Use `Taro.chooseMedia({ count: 1, mediaType: ["image"] })`, reject files above the configured client limit, render a crop-safe preview, request an upload intent and upload only after explicit confirmation.

- [ ] **Step 3: Implement task restoration**

On `useDidShow`, fetch the current task. Display persistent inline states for generation progress, preview ready, failed, cancelled and adopted. Do not use a blocking modal or require the page to stay open.

- [ ] **Step 4: Implement preview actions**

Show all four moods with an “AI 生成” label, name input, confirm adoption, one-time reroll and cancel. Keep the first preview visible while rerolling.

- [ ] **Step 5: Implement deletion**

Expose permanent deletion from the pet picker/details area with explicit confirmation. Link Settings “clear data” to the server cleanup before local storage is erased.

- [ ] **Step 6: Run typecheck and lint**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/pet/components/CustomPetFlow src/pages/pet/index.tsx src/pages/pet/index.scss src/pages/settings/index.tsx
git commit -m "feat: add custom pet adoption flow"
```

### Task 8: Add Custom Pets to Counting Games

**Files:**
- Modify: `src/pages/bird-count/gameLogic.ts`
- Modify: `src/pages/bird-count/index.tsx`
- Modify: `src/pages/head-count/gameLogic.ts`
- Test: `tests/unit/birdCountGameLogic.test.ts`
- Test: `tests/unit/headCountGameLogic.test.ts`

- [ ] **Step 1: Write failing instance-pool tests**

Use a pool containing two pets with the same template skin but different asset IDs. Assert both remain distinct candidates and target counting compares `petKey`, not only `skin`.

- [ ] **Step 2: Run tests and verify failure**

- [ ] **Step 3: Replace skin pools with game pet descriptors**

Define:

```ts
interface GamePetDescriptor {
  key: string;
  label: string;
  templateSkin: PetSkin;
  assetRef: PetAssetRef;
}
```

Questions and rendered items carry `petKey` and `assetRef`; fallback descriptors still cover all seven standard skins when the user has no living pets.

- [ ] **Step 4: Preload resolved dynamic images**

Resolve each descriptor/mood pair before starting. If a private asset fails, omit that descriptor from the session and rebuild the question set.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npm test -- --runTestsByPath tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/bird-count src/pages/head-count tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts
git commit -m "feat: use custom pets in counting games"
```

### Task 9: Add Custom Pets to Memory Challenge

**Files:**
- Modify: `src/pages/memory-challenge/gameLogic.ts`
- Modify: `src/pages/memory-challenge/index.tsx`
- Test: `tests/unit/memoryChallengeGameLogic.test.ts`

- [ ] **Step 1: Write failing dynamic memory-item tests**

Assert IDs include pet instance keys, two custom pets cannot collide with a standard pet using the same template skin, and failed private images remove only that pet rather than rejecting the whole pool.

- [ ] **Step 2: Run tests and verify failure**

- [ ] **Step 3: Update the loader**

Accept `GamePetDescriptor[]`, resolve each mood independently, keep complete pets only, and require at least four visual answers. Standard fallback pets fill the pool when needed.

- [ ] **Step 4: Use current user pets at game start**

Build the pool from living adopted pets with the active pet first, then preload before entering pet mode.

- [ ] **Step 5: Run focused tests**

```bash
npm test -- --runTestsByPath tests/unit/memoryChallengeGameLogic.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/memory-challenge tests/unit/memoryChallengeGameLogic.test.ts
git commit -m "feat: use custom pets in memory challenge"
```

### Task 10: Documentation, Full Verification and Deployment

**Files:**
- Modify: `docs/points-economy.md`
- Modify: `src/pages/pet/README.md`
- Modify: `.env.example`
- Modify: `scripts/check-secrets.sh` if new credential names need explicit coverage

- [ ] **Step 1: Document production configuration**

Document required model/provider environment variables, CloudBase collections, private storage permission, timer trigger, 300-point reservation semantics, one generation, one reroll and permanent deletion.

- [ ] **Step 2: Run all local verification**

```bash
npm run secrets:check
npm run assets:check
npm test
npm run typecheck
npm run lint
npm run build:weapp
```

Expected: all commands pass.

- [ ] **Step 3: Inspect package size and generated output**

Confirm no generated pet bitmap is bundled under `src/assets`, and verify custom-pet code does not introduce provider credentials or permanent private URLs into `dist/`.

- [ ] **Step 4: Deploy cloud functions when credentials are available**

```bash
npm run deploy:cloudfunctions
```

Then configure the `customPetRecovery` timer trigger and private storage rules in the target CloudBase environment.

- [ ] **Step 5: Run a real-device smoke test**

Verify one complete flow on a non-production test account: reserve points, background generation, return to preview, reroll, adopt, render in all pet games, and permanent delete.

- [ ] **Step 6: Commit documentation and any verification fixes**

```bash
git add docs/points-economy.md src/pages/pet/README.md .env.example scripts/check-secrets.sh
git commit -m "docs: document custom AI pet operations"
```
