# 游戏分组配色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页和全部游戏页中，为每个游戏分组提供一致、清爽的卡片色彩识别。

**Architecture:** 在游戏目录模块中提供由 `GameCategoryId` 生成语义 CSS 类名的纯函数，并由两个分组列表调用。共享卡片样式在分组容器上定义颜色变量，标题、数量胶囊、顶部横条与右上背景光斑只消费这些变量，保留每张游戏卡现有背景纹理。

**Tech Stack:** React、Taro、TypeScript、SCSS、Jest。

---

### Task 1: 为分组样式类建立可测试的目录契约

**Files:**
- Modify: `src/config/gameCatalog.ts`
- Modify: `tests/unit/gameCatalog.test.ts`

- [x] **Step 1: 编写失败的分组类名测试**

在 `tests/unit/gameCatalog.test.ts` 的 import 中加入 `getGameCategoryClass`，并新增：

```ts
test("maps every gameplay category to its shared styling class", () => {
  expect(GAME_CATEGORIES.map((category) => getGameCategoryClass(category.id))).toEqual([
    "game-category-math",
    "game-category-memory",
    "game-category-reasoning",
    "game-category-language",
    "game-category-challenge",
  ]);
});
```

- [x] **Step 2: 运行测试以确认失败**

Run: `npm test -- --runTestsByPath tests/unit/gameCatalog.test.ts`

Expected: FAIL，提示 `getGameCategoryClass` 尚未导出。

- [x] **Step 3: 实现最小目录函数**

在 `src/config/gameCatalog.ts` 的分类定义之后添加：

```ts
export function getGameCategoryClass(category: GameCategoryId) {
  return `game-category-${category}`;
}
```

- [x] **Step 4: 运行测试以确认通过**

Run: `npm test -- --runTestsByPath tests/unit/gameCatalog.test.ts`

Expected: PASS。

### Task 2: 将首页和全部游戏页绑定到分组色彩令牌

**Files:**
- Modify: `src/pages/index/index.tsx`
- Modify: `src/pages/all-games/index.tsx`

- [x] **Step 1: 使用共享类名函数为首页分组容器添加语义类**

从 `src/config/gameCatalog.ts` 导入 `getGameCategoryClass`，并将首页容器替换为：

```tsx
<View key={category.id} className={`game-category-section ${getGameCategoryClass(category.id)}`}>
```

- [x] **Step 2: 使用共享类名函数为全部游戏分组容器添加语义类**

从 `src/config/gameCatalog.ts` 导入 `getGameCategoryClass`，并将全部游戏页容器替换为：

```tsx
<View key={category.id} className={`game-category-section ${getGameCategoryClass(category.id)}`}>
```

- [x] **Step 3: 运行类型检查**

Run: `npm run typecheck`

Expected: PASS。

### Task 3: 在共享卡片层实现五组清爽配色

**Files:**
- Modify: `src/styles/game-list.scss`

- [x] **Step 1: 为五个分组容器声明色彩变量**

在 `.game-category-section` 后添加以 `--game-category-accent`、`--game-category-accent-soft` 和 `--game-category-accent-deep` 为接口的五个规则。颜色依次为：天蓝 `#2499d7`、紫色 `#8a6ee8`、薄荷绿 `#2dac83`、琥珀黄 `#d98c13`、珊瑚红 `#e96560`；soft 色使用相应颜色的约 14–18% 透明度。

- [x] **Step 2: 将标题与数量胶囊改为消费分组变量**

在分组范围内让 `.game-category-title` 使用深色变量，`.game-category-count` 使用 soft 背景与 accent 前景。保留默认变量作为未分组状态的回退值。

- [x] **Step 3: 为卡片实现顶部横条与柔和背景光斑**

保留 `.game-card::before` 作为 6px 顶部横条，并将背景改为 `var(--game-category-accent, var(--brand-secondary))`。保留 `.game-card::after` 的箭头，新增 `.game-card` 的多层背景：第一层是右上角低透明度径向光斑 `var(--game-category-accent-soft)`，第二层用 `var(--game-card-background, var(--surface-card))` 承接既有卡片背景。

- [x] **Step 4: 将现有单卡 `background` 规则迁移为背景变量**

把所有 `.card-*` 的 `background:` 声明改为 `--game-card-background:`，使每张卡的现有渐变继续存在于分组光斑下方。例如：

```scss
.card-mental {
  --game-card-background:
    radial-gradient(circle at 40% 28%, rgba(14, 116, 144, 0.16), transparent 34%),
    var(--surface-card);
}
```

- [x] **Step 5: 运行样式构建检查**

Run: `npm run build:weapp`

Expected: PASS，生成微信小程序构建产物。

### Task 4: 完整验证与提交

**Files:**
- Modify: `docs/superpowers/plans/2026-07-22-game-category-colors.md`
- Modify: `src/config/gameCatalog.ts`
- Modify: `src/pages/index/index.tsx`
- Modify: `src/pages/all-games/index.tsx`
- Modify: `src/styles/game-list.scss`
- Modify: `tests/unit/gameCatalog.test.ts`

- [x] **Step 1: 运行项目验证集**

Run: `npm test -- --runTestsByPath tests/unit/gameCatalog.test.ts && npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check && git diff --check`

Expected: 所有命令成功；若构建中出现 `punycode` 弃用警告但命令退出码为 0，则记录为非阻断警告。

- [x] **Step 2: 标记计划完成并检查暂存范围**

将本计划中的所有复选框更新为 `- [x]`，再运行：

Run: `git status --short && git diff --check`

Expected: 仅显示本计划列出的文件。

- [x] **Step 3: 创建提交**

Run:

```bash
git add docs/superpowers/plans/2026-07-22-game-category-colors.md src/config/gameCatalog.ts src/pages/index/index.tsx src/pages/all-games/index.tsx src/styles/game-list.scss tests/unit/gameCatalog.test.ts
git commit -m "feat: color game cards by category"
```

Expected: 创建仅包含分组配色实现与计划的提交。
