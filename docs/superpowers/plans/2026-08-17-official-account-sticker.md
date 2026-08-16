# 公众号贴图能力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页沉淀公众号贴图，并在各单项训练结算页快捷发表成绩，真实发表后每天最多奖励三次宠物积分。

**Architecture:** `stickerRewards` 维护按北京时间分组、由 postUrl 去重的奖励账本，并把账本纳入现有 CloudBase 用户快照。`stickerPublishing` 隔离微信原生 API 和文案构建，首页原生组件和结算复用按钮都只调用它。

**Tech Stack:** Taro 4、React 18、TypeScript、微信小程序 `official-account-publish` / `wx.shareToOfficialAccount`、Jest、CloudBase 快照同步。

---

### Task 1: 贴图奖励账本与云快照

**Files:**
- Create: `src/utils/stickerRewards.ts`
- Modify: `src/services/user-data/types.ts`
- Modify: `src/services/user-data/local/userDataLocalRepository.ts`
- Modify: `src/config/cloud.ts`
- Test: `tests/unit/stickerRewards.test.ts`
- Test: `tests/unit/userDataLocalRepository.test.ts`

- [ ] **Step 1: Write failing reward tests**

```ts
expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/a", now })).toEqual({ awardedPoints: 30, remainingClaims: 2 });
expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/a", now })).toEqual({ awardedPoints: 0, reason: "duplicate" });
expect(claimStickerReward({ postUrl: "https://mp.weixin.qq.com/s/d", now })).toEqual({ awardedPoints: 0, reason: "daily-limit" });
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --runInBand tests/unit/stickerRewards.test.ts`

- [ ] **Step 3: Implement ledger and shared reward call**

```ts
export const STICKER_REWARD_POINTS = 30;
export const STICKER_REWARD_DAILY_LIMIT = 3;
export function claimStickerReward(input: StickerRewardClaimInput): StickerRewardClaimResult;
```

Normalize `postUrl`, derive an Asia/Shanghai date key, reject duplicate/limit, persist the claim, then use `addPointsToPet("sticker-publish", 30, "normal", { applyDifficultyMultiplier: false, maxPoints: 30 })`.

- [ ] **Step 4: Add snapshot persistence**

Extend `UserCloudSnapshot` with `stickerRewardLedger`, default legacy snapshots to an empty ledger, bump `CLOUD_SCHEMA_VERSION`, and cover a snapshot round trip.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- --runInBand tests/unit/stickerRewards.test.ts tests/unit/userDataLocalRepository.test.ts`

```bash
git add src/utils/stickerRewards.ts src/services/user-data/types.ts src/services/user-data/local/userDataLocalRepository.ts src/config/cloud.ts tests/unit/stickerRewards.test.ts tests/unit/userDataLocalRepository.test.ts
git commit -m "feat: track rewarded official account stickers"
```

### Task 2: 微信发表服务与共享结算入口

**Files:**
- Create: `src/utils/stickerPublishing.ts`
- Create: `src/components/stickers/StickerShareButton.tsx`
- Create: `src/components/stickers/index.scss`
- Modify: project wx declaration file
- Test: `tests/unit/stickerPublishing.test.ts`

- [ ] **Step 1: Write failing payload and unsupported-environment tests**

```ts
expect(createStickerPublishPayload({ gameTitle: "速算挑战", score: 18, pagePath: "pages/mental-math/index" })).toMatchObject({
  title: "我在速算挑战拿到 18 分",
  tags: ["Cici脑力训练打卡"],
  recommendPath: "/pages/mental-math/index",
});
```

Also assert that H5 neither invokes `wx.shareToOfficialAccount` nor claims a reward.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --runInBand tests/unit/stickerPublishing.test.ts`

- [ ] **Step 3: Implement the native publication boundary**

`publishGameResultSticker()` runs only in weapp, calls `wx.shareToOfficialAccount`, and claims a reward only from a success callback with non-empty `postUrl`. It returns typed success, duplicate, daily-limit, cancellation, unsupported and failure results.

- [ ] **Step 4: Implement `StickerShareButton`**

The component accepts `gameTitle`, `score`, `pagePath`, and `disabled`; it prevents duplicate taps, reports callback status, and does not promise a reward before publication succeeds.

- [ ] **Step 5: Run focused tests/typecheck and commit**

Run: `npm test -- --runInBand tests/unit/stickerPublishing.test.ts && npm run typecheck`

```bash
git add src/utils/stickerPublishing.ts src/components/stickers tests/unit/stickerPublishing.test.ts
git commit -m "feat: publish training results as official account stickers"
```

### Task 3: 首页话题内容组件

**Files:**
- Create: `src/components/stickers/OfficialAccountPublishFeed.tsx`
- Modify: `src/pages/index/index.tsx`
- Modify: `src/pages/index/index.scss`
- Test: `tests/unit/stickerPublishing.test.ts`

- [ ] **Step 1: Write failing feed configuration test**

```ts
expect(getOfficialAccountPublishFeedProps()).toEqual({ topic: "Cici脑力训练打卡", limit: 4, placeholder: "晒出你的第一局训练吧", recommendPath: "/pages/index/index", recommendTitle: "Cici的脑部锻炼：每天练一点" });
```

- [ ] **Step 2: Run it and verify RED**

Run: `npm test -- --runInBand tests/unit/stickerPublishing.test.ts`

- [ ] **Step 3: Render the thin native wrapper**

Render `official-account-publish` only in weapp, forwarding `bindpublishsuccess` to the reward service and all non-success events to non-blocking feedback. Use native `topic`, `limit`, `placeholder`, `recommend-path`, and `recommend-title` attributes.

- [ ] **Step 4: Place on homepage, verify and commit**

Run: `npm test -- --runInBand tests/unit/stickerPublishing.test.ts && npm run typecheck`

```bash
git add src/components/stickers/OfficialAccountPublishFeed.tsx src/pages/index/index.tsx src/pages/index/index.scss tests/unit/stickerPublishing.test.ts
git commit -m "feat: show official account sticker feed on home"
```

### Task 4: 接入单项游戏结算页与积分说明

**Files:**
- Modify: `src/pages/{mental-math,pattern-completion,digit-span,twenty-four,rock-paper-scissors,color-trap,spatial-rotation,hidato,tents-camp,sumplete-grid,traffic-escape,netwalk,loop-line,number-order,memory-challenge,multiple-object-tracking,bird-count,word-scramble}/index.tsx`
- Modify: `docs/points-economy.md`
- Test: `tests/unit/stickerPublishing.test.ts`

- [ ] **Step 1: Write failing gauntlet exclusion test**

```ts
expect(canShareCompletedGameResult({ isGauntlet: false, completed: true })).toBe(true);
expect(canShareCompletedGameResult({ isGauntlet: true, completed: true })).toBe(false);
```

- [ ] **Step 2: Run it and verify RED**

Run: `npm test -- --runInBand tests/unit/stickerPublishing.test.ts`

- [ ] **Step 3: Add `StickerShareButton` to each listed normal-game result action group**

Pass visible title, final settled score, existing canonical share path and gauntlet flag. Exclude `game-gauntlet`, compatibility `head-count`, start, playing and interrupted states.

- [ ] **Step 4: Document the policy**

State that successful publication earns 30 points, at most 3 times daily, uses postUrl dedupe, and is outside training records and normal difficulty caps.

- [ ] **Step 5: Run focused checks and commit**

Run: `npm test -- --runInBand tests/unit/stickerRewards.test.ts tests/unit/stickerPublishing.test.ts && npm run typecheck && npm run lint`

```bash
git add src/pages docs/points-economy.md tests/unit/stickerPublishing.test.ts
git commit -m "feat: add result sticker sharing across training games"
```

### Task 5: Full verification

**Files:** Modify only if a verification defect is found.

- [ ] **Step 1: Run complete automated verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check -- --staged && git diff --check`

- [ ] **Step 2: Inspect mini-program output**

Confirm built homepage WXML contains `official-account-publish`, normal-game outputs contain result share actions, and gauntlet output does not.

- [ ] **Step 3: Validate with a qualified AppID when available**

On a mobile WeChat client with base library 3.16.1+, confirm only genuine callback success can issue a reward and a fourth same-day distinct post gets no points. Unsupported desktop clients must not grant rewards.
