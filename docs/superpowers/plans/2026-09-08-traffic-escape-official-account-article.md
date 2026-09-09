# 《车阵突围》公众号推广软文 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 产出一篇面向泛用户、与当前游戏实现一致且不绑定目标车辆颜色的《车阵突围》公众号推广软文。

**Architecture:** 只新增一个独立 Markdown 交付文件，不修改游戏代码、玩法、积分或远程素材。先依据当前源码和文档建立事实清单，再完成正文，最后用文本检查和人工通读验证颜色中立、事实准确与素材边界。

**Tech Stack:** Markdown、Git、ripgrep

---

## File Structure

- Create: `output/official-account/traffic-escape/article.md` — 保存完整公众号正文，以及文章后的建议标题、摘要、标签和内容边界。
- Reference: `docs/superpowers/specs/2026-09-08-traffic-escape-official-account-article-design.md` — 已确认的受众、叙事角度、措辞和验收标准。
- Reference: `src/pages/traffic-escape/index.tsx` — 开始页规则、难度选择和入口文案。
- Reference: `src/pages/traffic-escape/play.tsx` — 实际操作、提示代价、用时、移动次数与通关流程。
- Reference: `src/pages/traffic-escape/result.tsx` — 结算页信息与宠物积分展示。
- Reference: `src/config/gameCatalog.ts` — 分类、预计时长和训练方向。
- Reference: `docs/points-economy.md` — 宠物积分范围与奖励边界。

### Task 1: 建立可引用的事实清单

**Files:**
- Read: `docs/superpowers/specs/2026-09-08-traffic-escape-official-account-article-design.md`
- Read: `src/pages/traffic-escape/index.tsx`
- Read: `src/pages/traffic-escape/play.tsx`
- Read: `src/pages/traffic-escape/result.tsx`
- Read: `src/config/gameCatalog.ts`
- Read: `docs/points-economy.md`

- [ ] **Step 1: 核对玩法与操作**

确认文章只使用以下事实：车辆只能沿自身朝向直线移动且不能转弯；玩家点选车辆后通过方向按钮移动；目标是为目标车辆清出右侧出口。

- [ ] **Step 2: 核对模式与结算**

确认文章可以描述普通和困难两种难度、约两分钟一局、移动次数、用时、提示次数、结算得分和宠物积分；不得承诺固定得分或固定积分。

- [ ] **Step 3: 核对内容边界**

确认不把目标车辆写成任何固定颜色，不描述未经核验的截图或视频，不作提升智力、改善健康或治疗等效果承诺。

### Task 2: 撰写公众号文章

**Files:**
- Create: `output/official-account/traffic-escape/article.md`

- [ ] **Step 1: 创建正文结构**

文章依次使用：悬念开场、“车能动，路却未必通”、“不是走一步，而是为后面几步留位置”、“两种难度，一条出口”、“给目标车找一条路”和“发布信息”。

- [ ] **Step 2: 完成正文**

全文使用轻松、具象、略带挑战意味的语气。称呼限定为“目标车”或“目标车辆”；避免“训练大脑”“提升智力”等不可验证表述。正文不插入图片，因为当前没有经过核验的《车阵突围》实机截图。

- [ ] **Step 3: 补齐发布信息**

建议摘要控制为一至两句话，准确概括“沿朝向挪动车辆、为目标车清出出口”的玩法；标签包含“益智游戏”“空间规划”“碎片时间”“微信小程序”；内容边界明确说明只描述当前可验证玩法，不作认知或健康效果承诺。

### Task 3: 验证并提交文章

**Files:**
- Verify: `output/official-account/traffic-escape/article.md`

- [ ] **Step 1: 检查目标车辆颜色中立**

Run:

```bash
rg -n "红车|红色车辆|红色目标|蓝车|黄色目标" output/official-account/traffic-escape/article.md
```

Expected: 无输出，退出码为 1。

- [ ] **Step 2: 检查禁用效果承诺**

Run:

```bash
rg -n "提升智力|提高智商|预防痴呆|治疗|改善疾病" output/official-account/traffic-escape/article.md
```

Expected: 无输出，退出码为 1。

- [ ] **Step 3: 检查必需内容**

Run:

```bash
rg -n "目标车|只能沿|不能转弯|普通|困难|提示|移动|用时|宠物积分|约 2 分钟|发布信息" output/official-account/traffic-escape/article.md
```

Expected: 每个核心事实至少命中一次；如正文采用“约两分钟”，相应调整检查词但不得改变含义。

- [ ] **Step 4: 检查 Markdown 与工作区边界**

Run:

```bash
git diff --check -- output/official-account/traffic-escape/article.md
git status --short
```

Expected: `git diff --check` 无输出；只暂存本任务的文章文件，不纳入 `output/` 下其他既有内容。

- [ ] **Step 5: 提交文章**

```bash
git add -- output/official-account/traffic-escape/article.md
git commit -m "docs: add traffic escape promotion article"
```

Expected: 提交成功，提交中只有 `output/official-account/traffic-escape/article.md`。
