# Cloud Pet Count Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace farm count game emoji count objects with existing cloud pet sprite images and remove the start-page priority pet strip.

**Architecture:** Keep the existing game logic and pet-skin prioritization intact. Update only the farm count presentation layer so speed and yard modes render `PetSprite` instances for count objects.

**Tech Stack:** Taro React, TypeScript, SCSS, existing `PetSprite` cloud asset resolver.

---

### Task 1: Render Count Objects With Cloud Pet Sprites

**Files:**
- Modify: `src/pages/bird-count/index.tsx`
- Modify: `src/pages/bird-count/index.scss`

- [x] **Step 1: Remove emoji dependency from the farm count page**

Update `src/pages/bird-count/index.tsx` to stop importing `PET_SKIN_EMOJI`, while keeping `PET_SKIN_NAME` and `PetSkin`.

- [x] **Step 2: Add a local count sprite wrapper**

Create a small `CountPetSprite` component in `src/pages/bird-count/index.tsx` that wraps `PetSprite` with `mood="idle"` and accepts a count-specific class name.

- [x] **Step 3: Replace all count-object emoji nodes**

Replace target prompt, speed-mode tokens, yard static pets, yard moving pets, and hidden prompt placeholder with `CountPetSprite`.

- [x] **Step 4: Remove the start-page priority strip**

Delete the `pet-pool-strip` block from `src/pages/bird-count/index.tsx`. Do not remove the `petSkinPool` state or refresh logic because it still controls which cloud pet images appear first.

- [x] **Step 5: Update styles**

Remove `.pet-pool-*` and `*-emoji` styles from `src/pages/bird-count/index.scss`. Add sprite sizing rules for count tokens, mirrored tokens, target sprite, yard static pets, yard moving pets, and hidden placeholder.

- [x] **Step 6: Verify**

Run:

```bash
npm test -- --runInBand tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts
npm run typecheck
npm run build:weapp
npm run lint
npm run build:h5
```

Then smoke-test H5 with both farm modes and confirm the start page no longer shows “本局优先出现”.
