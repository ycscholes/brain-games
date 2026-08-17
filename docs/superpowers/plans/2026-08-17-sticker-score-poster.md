# 训练成绩贴图海报 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically attach a generated result poster to official-account sticker publishing.

**Architecture:** A focused poster utility owns Canvas drawing and temporary-file export. `StickerShareButton` mounts its hidden Canvas and requests the export before it calls the existing native publishing service. The service accepts an optional image path and keeps text-only fallback behavior.

**Tech Stack:** Taro React, WeChat Mini Program Canvas, Jest, TypeScript.

---

### Task 1: Add the publication image contract

**Files:**
- Modify: `src/utils/stickerPublishing.ts`
- Test: `tests/unit/stickerPublishing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
expect(createStickerPublishPayload({
  gameTitle: "速算挑战", score: 18, pagePath: "pages/mental-math/index", imagePath: "wxfile://poster.png",
}).images).toEqual(["wxfile://poster.png"]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand tests/unit/stickerPublishing.test.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
images: imagePath ? [imagePath] : undefined,
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 2: Draw and export the score poster

**Files:**
- Create: `src/components/stickers/StickerScorePoster.tsx`
- Modify: `types/cloud.d.ts`
- Test: `tests/unit/stickerScorePoster.test.ts`

- [ ] **Step 1: Write failing tests for a score-specific poster export and export-error rejection.**
- [ ] **Step 2: Run `npm test -- --runInBand tests/unit/stickerScorePoster.test.ts` and confirm failure.**
- [ ] **Step 3: Add a hidden Canvas component that draws the title, score and reward copy, then exports a PNG temporary path.**
- [ ] **Step 4: Rerun the focused test and confirm success.**
- [ ] **Step 5: Commit.**

### Task 3: Connect export to the shared result action

**Files:**
- Modify: `src/components/stickers/StickerShareButton.tsx`
- Test: `tests/unit/stickerPublishing.test.ts`

- [ ] **Step 1: Write a failing test proving the publish input can carry the exported image and that no-image fallback remains valid.**
- [ ] **Step 2: Run the focused test and confirm failure.**
- [ ] **Step 3: Await poster export on click, call the existing service with its path when available, and continue with no image after export failure.**
- [ ] **Step 4: Run focused tests, `npm run typecheck`, `npm run lint`, and `npm run build:weapp`.**
- [ ] **Step 5: Commit.**
