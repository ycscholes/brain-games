# 宠物素材重新生成 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据设计方案重新生成 15 张宠物素材，替换现有不符合生产要求的素材，保持代码兼容性，提升视觉质量。

**Architecture:** 基于水彩手绘风格方案，按统一规格生成 5 种宠物 × 3 种状态共计 15 张 PNG 图片。保持现有文件名完全不变，生成后直接替换，组件代码无需修改。

**Tech Stack:** AI 图像生成（Midjourney / DALL-E / SDXL）+ 后处理统一规格裁切。

---

## 文件影响

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `src/assets/pets/*.png` | 替换 | 保持文件名完全一致，替换 15 张图片 |
| `docs/superpowers/specs/2026-04-08-pet-assets-regeneration-design.md` | 已有 | 设计方案文档 |
| `docs/superpowers/plans/2026-04-08-pet-assets-regeneration.md` | 新建 | 本实施计划 |

---

## 任务分解

### 任务 1: 验证现有文件结构和命名

**文件：**
- 检查: `src/assets/pets/`

- [ ] **Step 1: 列出当前文件清单验证命名**

```bash
ls -la src/assets/pets/
```

**预期输出：** 应有以下 15 个文件：
```
cat-idle.png
cat-feed.png
cat-cuddle.png
dog-idle.png
dog-feed.png
dog-cuddle.png
rabbit-idle.png
rabbit-feed.png
rabbit-cuddle.png
bear-idle.png
bear-feed.png
bear-cuddle.png
panda-idle.png
panda-feed.png
panda-cuddle.png
```

- [ ] **Step 2: 验证当前图片尺寸和格式**

```bash
# 检查每张图片尺寸
file src/assets/pets/*.png
```

**预期输出：** 当前应为 720x720，将被替换为 512x512。

- [ ] **Step 3: Commit 检查点**

```bash
git status
```
确认现有文件已被 git 跟踪，准备后续替换。

---

### 任务 2: 按设计方案生成 15 张图片

根据设计方案中的提示词模板，逐张生成：

**生成顺序（按宠物 × 状态）：**

- [ ] **Step 1: 生成 cat 系列 (3 张)**
  - `cat-idle.png` - 橘猫，待机姿势
  - `cat-feed.png` - 橘猫，喂食姿势
  - `cat-cuddle.png` - 橘猫，抱抱互动姿势

- [ ] **Step 2: 生成 dog 系列 (3 张)**
  - `dog-idle.png` - 小狗，待机姿势
  - `dog-feed.png` - 小狗，喂食姿势
  - `dog-cuddle.png` - 小狗，抱抱互动姿势

- [ ] **Step 3: 生成 rabbit 系列 (3 张)**
  - `rabbit-idle.png` - 兔子，待机姿势
  - `rabbit-feed.png` - 兔子，喂食姿势
  - `rabbit-cuddle.png` - 兔子，抱抱互动姿势

- [ ] **Step 4: 生成 bear 系列 (3 张)**
  - `bear-idle.png` - 棕熊，待机姿势
  - `bear-feed.png` - 棕熊，喂食姿势
  - `bear-cuddle.png` - 棕熊，抱抱互动姿势

- [ ] **Step 5: 生成 panda 系列 (3 张)**
  - `panda-idle.png` - 熊猫，待机姿势
  - `panda-feed.png` - 熊猫，喂食姿势
  - `panda-cuddle.png` - 熊猫，抱抱互动姿势

**每张图片生成后必须满足：**
- 尺寸：512 × 512 px（允许 1024×1024 后缩放）
- 格式：PNG with RGBA 透明通道
- 背景：完全透明，无底板、无阴影、无场景
- 构图：宠物居中，主体占 70%-80%，四边留边距，无裁剪

---

### 任务 3: 质量检查与规格验证

对生成好的 15 张图片逐项检查：

- [ ] **Step 1: 检查尺寸和格式**

```bash
# 使用 identify 检查每张图片
file src/assets/pets/*.png
```

验证：所有文件都是 512x512 PNG。

- [ ] **Step 2: 检查透明背景**

使用图像工具验证 alpha 通道正确，背景完全透明，无白色残留。

- [ ] **Step 3: 检查构图与辨识性**

- 五种宠物特征清晰可辨
- 三种状态姿势差异明显
- 所有部位都在画布内，无裁剪

- [ ] **Step 4: 小尺寸可读性测试**

缩放到 64px / 96px / 128px 验证仍然可辨。

- [ ] **Step 5: 检查文件名完全正确**

验证文件名与设计方案要求完全一致（大小写、连字符都正确）。

---

### 任务 4: 替换现有文件并验证运行

- [ ] **Step 1: 将生成好的文件放入 `src/assets/pets/` 目录**

覆盖现有文件。

- [ ] **Step 2: 验证编译运行**

```bash
# 检查项目能正常编译
npm run build:weapp
```

- [ ] **Step 3: 在开发工具中预览验证**

打开微信开发者工具，验证：
- 宠物正常显示
- 切换 idle/feed/cuddle 状态动画正常
- 透明背景与组件阴影叠加正确，不脏
- 五种宠物在列表中辨识度足够

- [ ] **Step 4: Commit changes**

```bash
git add src/assets/pets/*.png
git commit -m "feat: regenerate pet assets with watercolor hand-painted style"
```

---

### 任务 5: 最终确认

- [ ] **Step 1: 检查 git diff 确认改动范围**

```bash
git diff HEAD --name-only
```

验证：仅替换了图片文件，代码无变动。

- [ ] **Step 2: 完成**

所有 15 张图片替换完成，符合设计规格，可正常运行。
