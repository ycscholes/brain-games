# Farm Count Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 宠物速数 and 小剧场清点 into one farm-themed game entry with two modes and adopted-pet-first counting objects.

**Architecture:** Keep `/pages/bird-count/index` as the canonical merged page. Reuse existing `bird-count` and `head-count` scoring/session logic, add a small pet-skin-pool seam, and render both modes from one farm-themed page. Preserve `head-count` as a compatibility redirect so existing links open the merged page in yard mode.

**Tech Stack:** Taro 4, React 18, TypeScript, Sass, Jest.

---

## File Structure

- Modify `src/pages/bird-count/gameLogic.ts`: accept an optional `PetSkin[]` pool for target/decoy generation while preserving current defaults.
- Modify `tests/unit/birdCountGameLogic.test.ts`: lock down adopted-pet pool behavior and default fallback behavior.
- Modify `src/pages/bird-count/index.tsx`: own the merged game modes, read prioritized adopted pets, start either speed-count or yard-count sessions, and record results with the existing game ids.
- Replace `src/pages/bird-count/index.scss`: farm visual system shared by start, play, options, feedback, and result screens.
- Modify `src/pages/bird-count/index.config.ts`: update navigation title and share settings.
- Replace `src/pages/head-count/index.tsx`: compatibility redirect to `/pages/bird-count/index?mode=yard`.
- Replace or simplify `src/pages/head-count/index.scss`: minimal loading style for the redirect page.
- Modify `src/pages/head-count/index.config.ts`: title should match the merged farm game or compatibility mode.
- Modify `src/pages/index/index.tsx`: replace the two separate home cards with one `farm-count` card pointing at `/pages/bird-count/index`.

## Task 1: Add Pet Pool Support To Speed Count Logic

**Files:**
- Modify: `src/pages/bird-count/gameLogic.ts`
- Modify: `tests/unit/birdCountGameLogic.test.ts`

- [ ] **Step 1: Add failing tests for custom pet pools**

Append tests that verify the target and decoys come from the provided pool:

```ts
import {
  createBirdCountQuestion,
  PET_COUNT_SKINS,
} from "../../src/pages/bird-count/gameLogic";

describe("bird count pet pool", () => {
  it("uses a provided pet skin pool for target and decoy pets", () => {
    const question = createBirdCountQuestion("normal", 0, ["dog", "rabbit"]);
    const usedSkins = new Set(question.pets.map((pet) => pet.skin));

    expect(["dog", "rabbit"]).toContain(question.targetSkin);
    usedSkins.forEach((skin) => {
      expect(["dog", "rabbit"]).toContain(skin);
    });
  });

  it("falls back to the full pet pool when a provided pool is empty", () => {
    const question = createBirdCountQuestion("normal", 0, []);

    expect(PET_COUNT_SKINS).toContain(question.targetSkin);
    expect(question.pets.length).toBe(question.totalPets);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- --runInBand tests/unit/birdCountGameLogic.test.ts
```

Expected: fails because `createBirdCountQuestion` does not accept or use a custom skin pool yet.

- [ ] **Step 3: Implement optional skin-pool support**

Change `pickTargetSkin`, `createPetSkinPool`, `createBirdCountQuestion`, and `createBirdCountSession` so the pool is normalized once and defaults to `PET_COUNT_SKINS`:

```ts
function normalizePetSkinPool(petSkinPool?: PetSkin[]) {
  const uniqueSkins = Array.from(new Set(petSkinPool ?? PET_COUNT_SKINS))
    .filter((skin): skin is PetSkin => PET_COUNT_SKINS.includes(skin));
  return uniqueSkins.length > 0 ? uniqueSkins : PET_COUNT_SKINS;
}

function pickTargetSkin(questionIndex: number, petSkinPool?: PetSkin[]) {
  const skins = normalizePetSkinPool(petSkinPool);
  return skins[questionIndex % skins.length];
}

function createPetSkinPool(targetSkin: PetSkin, targetCount: number, totalPets: number, petSkinPool?: PetSkin[]) {
  const skins: PetSkin[] = Array.from({ length: targetCount }, () => targetSkin);
  const availableSkins = normalizePetSkinPool(petSkinPool);
  const decoys = availableSkins.filter((skin) => skin !== targetSkin);
  const fallbackDecoys = decoys.length > 0 ? decoys : availableSkins;

  while (skins.length < totalPets) {
    const decoyIndex = (skins.length + Math.floor(Math.random() * fallbackDecoys.length)) % fallbackDecoys.length;
    skins.push(fallbackDecoys[decoyIndex]);
  }

  return shuffle(skins);
}
```

Update exported signatures:

```ts
export function createBirdCountQuestion(
  difficulty: BirdCountDifficulty,
  questionIndex: number,
  petSkinPool?: PetSkin[],
): BirdCountQuestion

export function createBirdCountSession(difficulty: BirdCountDifficulty, petSkinPool?: PetSkin[])
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
npm test -- --runInBand tests/unit/birdCountGameLogic.test.ts
```

Expected: all bird-count logic tests pass.

## Task 2: Build Prioritized Adopted Pet Pool

**Files:**
- Modify: `src/pages/bird-count/index.tsx`

- [ ] **Step 1: Add helper functions near the top of `index.tsx`**

Add pure helpers to derive the display pool:

```ts
function getPrioritizedPetSkins() {
  const petData = syncPetData({ markChanged: false });
  const alivePets = petData.pets.filter((pet) => pet.status !== "dead");
  const activePet = alivePets.find((pet) => pet.id === petData.activePetId) ?? null;
  const orderedPets = [
    ...(activePet ? [activePet] : []),
    ...alivePets.filter((pet) => pet.id !== activePet?.id),
  ];
  const skins = Array.from(new Set(orderedPets.map((pet) => pet.skin)));

  return skins.length > 0 ? skins : PET_COUNT_SKINS;
}

function getPetSkinForIndex(petSkinPool: PetSkin[], index: number) {
  return petSkinPool[index % petSkinPool.length] ?? PET_COUNT_SKINS[index % PET_COUNT_SKINS.length];
}
```

Ensure `syncPetData` and `PET_COUNT_SKINS` are imported.

- [ ] **Step 2: Store the pool in page state and refresh on load/show**

Add state:

```ts
const [petSkinPool, setPetSkinPool] = useState<PetSkin[]>(PET_COUNT_SKINS);
```

Refresh in `useLoad` and `useDidShow`:

```ts
const refreshPetSkinPool = useCallback(() => {
  setPetSkinPool(getPrioritizedPetSkins());
}, []);
```

Call `refreshPetSkinPool()` alongside `refreshBest()`.

## Task 3: Merge Modes In The Canonical Page

**Files:**
- Modify: `src/pages/bird-count/index.tsx`
- Modify: `src/pages/bird-count/index.config.ts`

- [ ] **Step 1: Add mode types and route parsing**

Add:

```ts
type FarmCountMode = "speed" | "yard";
type Phase = "start" | "ready" | "watching" | "playing-event" | "answering" | "feedback" | "finished";

function normalizeMode(value?: string): FarmCountMode {
  return value === "yard" ? "yard" : "speed";
}
```

Use `useLoad((query) => { setMode(normalizeMode(String(query.mode ?? ""))); ... })`.

- [ ] **Step 2: Keep separate state for yard mode**

Import from `../head-count/gameLogic`:

```ts
createHeadCountSession,
getHeadCountRewardDifficulty,
HEAD_COUNT_SPEED_LABELS,
HEAD_COUNT_TOTAL_QUESTIONS,
scoreHeadCountQuestion,
type HeadCountDifficulty,
type HeadCountEvent,
type HeadCountQuestion,
type HeadCountQuestionResult,
type HeadCountSpeedDifficulty,
```

Add state equivalent to the existing head-count page:

```ts
const [mode, setMode] = useState<FarmCountMode>("speed");
const [yardDifficulty, setYardDifficulty] = useState<HeadCountDifficulty>("normal");
const [speedDifficulty, setSpeedDifficulty] = useState<HeadCountSpeedDifficulty>("slow");
const [yardQuestions, setYardQuestions] = useState<HeadCountQuestion[]>([]);
const [eventIndex, setEventIndex] = useState(-1);
const [displayCount, setDisplayCount] = useState(0);
const [lastYardResult, setLastYardResult] = useState<HeadCountQuestionResult | null>(null);
```

- [ ] **Step 3: Route startGame and answer handling by mode**

Create `startSpeedGame`, `startYardGame`, `handleSpeedAnswer`, `handleYardAnswer`, and a routing wrapper:

```ts
const startGame = () => {
  if (mode === "yard") {
    startYardGame();
    return;
  }
  startSpeedGame();
};
```

Speed mode keeps the current bird-count behavior but calls:

```ts
const nextQuestions = createBirdCountSession(difficulty, petSkinPool);
```

Yard mode uses the existing head-count flow and records:

```ts
const rewardDifficulty = getHeadCountRewardDifficulty(yardDifficulty, speedDifficulty);
recordTrainingSession({
  gameId: "head-count",
  score: finalScore,
  awardedPoints: nextAwardedPoints,
  durationSeconds,
  mode: `${yardDifficulty}:${speedDifficulty}`,
  difficulty: rewardDifficulty,
  outcome: "completed",
});
```

- [ ] **Step 4: Render shared start screen with mode selector**

Start screen content:

```tsx
<Text className="hero-title">农场清点</Text>
<Text className="hero-copy">在农场里观察宠物，选择速数或进出清点模式。</Text>
<View className="mode-grid">
  <View className={`mode-card ${mode === "speed" ? "mode-card-active" : ""}`} onClick={() => switchMode("speed")}>
    <Text className="mode-name">宠物速数</Text>
    <Text className="mode-copy">快速滚过一群宠物，只数指定宠物。</Text>
  </View>
  <View className={`mode-card ${mode === "yard" ? "mode-card-active" : ""}`} onClick={() => switchMode("yard")}>
    <Text className="mode-name">农场进出</Text>
    <Text className="mode-copy">观察宠物进出围栏，清点最后数量。</Text>
  </View>
</View>
```

Show difficulty controls for speed mode and event/speed controls for yard mode.

- [ ] **Step 5: Render farm play scenes for both modes**

Speed scene keeps scrolling pet tokens in a farm lane. Yard scene renders:

```tsx
<View className={`farm-pen farm-pen-${phase}`}>
  <View className="farm-gate farm-gate-left"><Text className="farm-gate-label">入口</Text></View>
  <View className="farm-yard">
    <Text className="yard-count">{getYardCountText(phase, displayCount, currentYardQuestion.answer)}</Text>
    <View className="yard-pet-row">
      {Array.from({ length: Math.min(staticPetCount, 10) }, (_, index) => (
        <View key={`yard-pet-${index}`} className="yard-pet-token">
          <Text className="yard-pet-emoji">{PET_SKIN_EMOJI[getPetSkinForIndex(petSkinPool, index)]}</Text>
        </View>
      ))}
    </View>
  </View>
  <View className="farm-gate farm-gate-right"><Text className="farm-gate-label">出口</Text></View>
</View>
```

For moving pets, use the current event delta and `getPetSkinForIndex(petSkinPool, eventIndex + personIndex)`.

- [ ] **Step 6: Update page config**

Set:

```ts
export default definePageConfig({
  navigationBarTitleText: "农场清点",
  enableShareAppMessage: true,
  enableShareTimeline: true,
});
```

## Task 4: Add Compatibility Redirect

**Files:**
- Replace: `src/pages/head-count/index.tsx`
- Replace: `src/pages/head-count/index.scss`
- Modify: `src/pages/head-count/index.config.ts`

- [ ] **Step 1: Replace page component with redirect**

Use:

```tsx
import { useEffect } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

export default function HeadCountRedirect() {
  useEffect(() => {
    Taro.redirectTo({ url: "/pages/bird-count/index?mode=yard" }).catch(() => {
      Taro.navigateTo({ url: "/pages/bird-count/index?mode=yard" });
    });
  }, []);

  return (
    <View className="head-count-redirect-page">
      <Text className="redirect-text">正在进入农场清点...</Text>
    </View>
  );
}
```

- [ ] **Step 2: Replace redirect styles**

Use:

```scss
.head-count-redirect-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  box-sizing: border-box;
  background: #f7fee7;
}

.redirect-text {
  font-size: 28px;
  line-height: 1.4;
  font-weight: 800;
  color: #365314;
}
```

- [ ] **Step 3: Update config title**

Use:

```ts
export default definePageConfig({
  navigationBarTitleText: "农场清点",
  enableShareAppMessage: true,
  enableShareTimeline: true,
});
```

## Task 5: Replace Home Entry

**Files:**
- Modify: `src/pages/index/index.tsx`

- [ ] **Step 1: Replace `BASE_GAMES` entries**

Remove the separate `head-count` and `bird-count` entries and add:

```ts
{
  id: "bird-count",
  title: "农场清点",
  badge: "观察",
  cardClass: "card-bird-count",
  url: "/pages/bird-count/index",
  category: "advanced",
  duration: "约 2 分钟",
  skill: "动态计数",
  level: "标准",
},
```

- [ ] **Step 2: Update game title labels**

Change:

```ts
"bird-count": "农场清点",
```

Keep:

```ts
"head-count": "农场进出",
```

so old records render with a meaningful mode name.

## Task 6: Farm Visual Polish

**Files:**
- Replace: `src/pages/bird-count/index.scss`

- [ ] **Step 1: Replace page styles with farm theme**

Use a warm green/yellow farm palette, stable grid dimensions, and shared classes for:

```scss
.farm-count-page
.farm-start
.farm-play
.farm-result
.farm-hero
.mode-grid
.mode-card
.farm-scene
.scroll-viewport
.scroll-track
.pet-count-token
.farm-pen
.farm-yard
.yard-pet-token
.moving-yard-pet
.option-grid
.option-card
.feedback-card
.result-card
```

Preserve the existing animation names or add new keyframes:

```scss
@keyframes farm-scroll {
  from { transform: translateX(92%); }
  to { transform: translateX(-118%); }
}

@keyframes yard-enter {
  from { transform: translateX(-130px) scale(0.92); opacity: 0; }
  20% { opacity: 1; }
  to { transform: translateX(230px) scale(1); opacity: 1; }
}

@keyframes yard-leave {
  from { transform: translateX(230px) scale(1); opacity: 1; }
  80% { opacity: 1; }
  to { transform: translateX(520px) scale(0.92); opacity: 0; }
}
```

- [ ] **Step 2: Check text fit**

Review long labels: `农场进出`, `当前设置最高`, `宠物积分`, speed card copy. Ensure option cards and status cards have fixed min-heights and text wrapping.

## Task 7: Verification And Commit

**Files:**
- All files changed by Tasks 1-6.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- --runInBand tests/unit/birdCountGameLogic.test.ts tests/unit/headCountGameLogic.test.ts
```

Expected: both suites pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Run WeChat build**

Run:

```bash
npm run build:weapp
```

Expected: exits 0 and produces the mini program build output.

- [ ] **Step 4: Inspect worktree and stage only task files**

Run:

```bash
git status --short
git add src/pages/bird-count/index.tsx src/pages/bird-count/index.scss src/pages/bird-count/index.config.ts src/pages/bird-count/gameLogic.ts tests/unit/birdCountGameLogic.test.ts src/pages/head-count/index.tsx src/pages/head-count/index.scss src/pages/head-count/index.config.ts src/pages/index/index.tsx docs/superpowers/plans/2026-06-06-farm-count-modes.md
```

Expected: unrelated pre-existing changes remain unstaged.

- [ ] **Step 5: Commit**

Run:

```bash
git commit -m "Merge count games into farm modes"
```

Expected: commit includes only the task files above.

## Self-Review

- Spec coverage: the plan covers the unified route, compatibility route, home entry replacement, adopted-pet-first skin pool, independent records, farm visuals, timer-safe mode switching, and verification.
- Placeholder scan: no unresolved placeholder markers are present.
- Type consistency: `FarmCountMode`, `PetSkin`, `HeadCountQuestion`, `HeadCountSpeedDifficulty`, and existing game ids match the source files.
