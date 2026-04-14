# 宠物素材重新生成设计方案

## 项目背景

当前项目「小院」是一个微信小程序，包含宠物领养、喂养系统。现有 5 种宠物（猫、狗、兔、熊、熊猫），每种宠物需要 3 种动作状态（待机idle、喂食feed、互动cuddle），共计 15 张 PNG 图片。

现有素材不符合生产级要求，需要重新生成。

---

## 现有问题分析

| 问题 | 说明 |
|------|------|
| 规格不统一 | 当前素材 720x720，建议统一 512x512 |
| 背景不干净 | 素材自带白色圆角底板+阴影，与组件阴影叠加导致视觉偏脏 |
| 动作差异弱 | 三种状态仅微调表情，身体姿态变化不足，小尺寸下难以辨认 |
| 辨识度不够 | 五种宠物轮廓特征不够强化，bear 和 panda 容易混淆 |
| 生产感不足 | 整体偏向贴纸风格，缺乏产品级角色资产的统一稳定性 |

---

## 风格选择

用户选择：**C - 水彩手绘风格**

### 风格特点

- 温暖治愈的水彩手绘质感
- 边缘柔和自然，色彩通透
- 给人温馨陪伴的情感氛围
- 符合"小院"产品定位

---

## 输出规格规范

### 基础要求

| 项 | 规范 |
|----|------|
| 尺寸 | 512 x 512 px（可先出 1024x1024 再缩放） |
| 格式 | PNG RGBA（带透明通道） |
| 背景 | 完全透明，**不允许**有底板、阴影、场景 |
| 构图 | 单宠物居中，四边留安全边距，主体占画布 70%-80% |
| 命名 | 严格保持现有命名规则（见下文） |

### 命名规范

必须严格遵循此命名，组件无需改代码即可直接使用：

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

---

## 角色特征定义

为保证辨识度，每种宠物的特征必须强化：

| 宠物 | 核心特征 |
|------|----------|
| **cat**（橘猫） | 三角形耳朵，橙色条纹，细小尾巴，圆润脸颊 |
| **dog**（小狗） | 下垂耳朵，圆形嘴部，温和忠诚表情 |
| **rabbit**（兔子） | 长耳朵，粉色点缀，精致鼻头，甜美表情 |
| **bear**（棕熊） | 圆形小耳朵，大头短肢，厚实身体，慵懒表情 |
| **panda**（熊猫） | 黑色耳朵，黑眼圈，黑色四肢，无辜明亮眼神 |

---

## 动作状态定义

每种状态必须有明显身体姿态差异，而非仅表情微调：

| 状态 | 动作要求 |
|------|----------|
| **idle**（待机） | 安静坐/站，眼神平静，放松微笑，平衡姿势 |
| **feed**（喂食） | 身体微微前倾，嘴部靠近食物，眼神充满期待，开心的进食表情 |
| **cuddle**（互动） | 身体向前倾，像是要抱抱的姿势，眼睛温柔闭合，脸蛋微红，充满温暖亲切感 |

---

## AI 生成提示词模板

### 水彩手绘风格 - 通用基础提示词

```
A single cute chibi pet mascot in watercolor hand-painted style, [species], [mood], full-body centered composition, soft watercolor edges, translucent color washes, warm cozy feeling, gentle watercolor texture, transparent alpha channel, isolated subject only, clean edges, commercial mascot design for mobile app, high readability even at small sizes, no background scene, no frame, no border, no text, no watermark, no floor shadow, no extra elements
```

### 各宠物提示词

**cat（橘猫）**
```
orange tabby cat, triangular ears, rounded cheeks, tiny striped tail, warm and friendly expression
```

**dog（小狗）**
```
small puppy dog, floppy ears, rounded muzzle, gentle expression, friendly and loyal look
```

**rabbit（兔子）**
```
fluffy rabbit, long ears, soft pink accents, delicate nose, sweet expression
```

**bear（棕熊）**
```
round brown bear, small round ears, sturdy body, thick paws, cozy expression
```

**panda（熊猫）**
```
cute panda, black ears, black eye patches, dark limbs, bright and innocent expression
```

### 各状态提示词

**idle（待机）**
```
neutral idle pose, sitting calmly, relaxed smile, balanced posture
```

**feed（喂食）**
```
feeding pose, leaning slightly forward, mouth close to food, tiny orange fruit, lively appetite expression
```

**cuddle（互动）**
```
cuddle pose, leaning forward as if for a hug, eyes gently closed, soft blush on cheeks, affectionate warm feeling
```

---

## 工具特定模板

### Midjourney

```
/imagine prompt: A single cute chibi [species] pet in watercolor hand-painted style, [mood], full-body centered composition, soft watercolor edges, translucent washes, warm cozy feeling, textured paper, transparent background, commercial mascot for mobile app, high readability, isolated subject, no background, no frame, no border, no text, no shadow --ar 1:1 --stylize 100 --quality 1
```

**Negative prompts:**
```
--no background scene frame border text watermark shadow floor cropped ears extra limbs
```

**后处理：**
生成后需要手动去除背景，导出透明 PNG，调整到 512x512。

---

### DALL-E 3

```
Create a single isolated cute pet mascot for a mobile app. Character: [species] in [mood] pose. Style: watercolor hand-painted, soft translucent color washes, warm cozy texture on watercolor paper, cute chibi proportions, full-body centered composition, transparent background, commercial mascot design, high readability at small sizes. Avoid: background scenery, frame, border, text, watermark, floor shadow, extra props. Keep edges clean with subject only.
```

DALL-E 3 原生支持透明背景输出，直接要求即可。

---

### Stable Diffusion / SDXL

**Positive:**
```
cute chibi pet mascot, [species], [mood], full body centered, watercolor painting, hand-painted, soft edges, translucent color washes, warm cozy, textured paper, transparent background, clean silhouette, commercial app mascot, highly readable, isolated subject, pastel colors, soft shading, cartoon illustration
```

**Negative:**
```
background, scenery, floor, shadow, frame, border, text, watermark, logo, extra limbs, cropped ears, low quality, blurry, photorealistic, heavy ink outline, flat vector, messy composition
```

**参数建议：**
- 分辨率：1024x1024
- Steps: 28-35
- CFG scale: 5-7
- Sampler: DPM++ 2M Karras
- 同一宠物保持相同 seed 保证一致性

---

## 最终交付检查清单

交付前必须逐项检查：

- [ ] 所有 15 张图尺寸都是 512x512 PNG
- [ ] 所有 15 张图都有正确的透明 alpha 通道
- [ ] 没有底板、没有背景、没有内置阴影
- [ ] 宠物居中，四边安全边距足够，没有裁剪耳朵/尾巴
- [ ] 五种宠物特征鲜明，容易区分
- [ ] 三种状态姿势差异明显，小尺寸能辨认
- [ ] 光影方向一致，色调风格统一
- [ ] 文件名完全符合规范
- [ ] 在 64px/96px/128px 尺寸下测试可读性
- [ ] 边缘干净，没有噪点、锯齿、脏边

---

## 替换方式

生成完成后，直接替换 `src/assets/pets/` 目录下的对应文件即可。组件代码无需任何修改，因为文件名保持完全一致。

---

## 方案总结

| 项 | 内容 |
|----|------|
| 风格 | 水彩手绘风格 |
| 数量 | 5 种宠物 × 3 种状态 = 15 张 |
| 规格 | 512x512 PNG 透明背景 |
| 替换成本 | 零代码修改，直接覆盖文件 |
| 预期效果 | 温暖治愈氛围，产品级辨识度，小程序渲染清晰 |
