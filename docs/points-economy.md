# 积分系统设计文档

## 概述

本文档描述了脑力小游戏项目中的宠物积分经济系统，包括积分获取机制、积分消费机制，以及经济平衡设计。

---

## 1. 积分获取机制

### 1.1 转换率设计原则

每个游戏的得分系统不同，为了确保玩家在不同游戏中获得相似努力程度下获得大致相当的奖励，我们设计了统一的转换率。

**目标范围**：一局游戏的良好表现应获得 10-40 宠物积分。

### 1.2 各游戏转换率

| 游戏名称 | 转换率 | 典型分数范围 | 积分范围 | 说明 |
|---------|-------|------------|---------|------|
| **数字广度 (digit-span)** | 3.0x | 5-10 | 15-30 | 分数较低，提升 3 倍 |
| **心算大师 (mental-math)** | 1.0x | 10-30 | 10-30 | 分数适中，保持 1 倍 |
| **图案推理 (pattern-completion)** | 1.2x | 10-30 | 12-36 | 略有提升，1.2 倍 |
| **双任务挑战 (dual-task)** | 0.05x | 200-800 | 10-40 | 分数极高，大幅降低 |
| **多目标追踪 (multiple-object-tracking)** | 3.0x | 5-15 | 15-45 | 分数较低，提升 3 倍 |
| **逆向猜拳 (rock-paper-scissors)** | 0.15x | 100-300 | 15-45 | 分数较高，降低到 0.15 倍 |
| **记忆挑战 (memory-challenge)** | 0.25x | 50-150 | 12-37 | 分数较高，降低到 0.25 倍 |

### 1.3 核心实现

**文件**：`src/utils/trainingStorage.ts`

```typescript
export function getAwardedPoints(gameId: string, score: number) {
  const conversionRates: Record<string, number> = {
    "memory-challenge": 0.25,
    "rock-paper-scissors": 0.15,
    "dual-task": 0.05,
    "mental-math": 1,
    "digit-span": 3,
    "multiple-object-tracking": 3,
    "pattern-completion": 1.2,
    memory: 0.25,
    rps: 0.15,
    mot: 3,
    pattern: 1.2,
  };

  const rate = conversionRates[gameId] ?? 0;
  return Math.max(0, Math.floor(score * rate));
}
```

### 1.4 游戏 ID 规范

所有游戏统一使用长名称作为 gameId：

| 游戏 | 标准 gameId | 旧缩写（仅用于向后兼容） |
|------|------------|-------------------------|
| 记忆挑战 | `memory-challenge` | `memory` |
| 逆向猜拳 | `rock-paper-scissors` | `rps` |
| 双任务挑战 | `dual-task` | `dual-task` |
| 心算大师 | `mental-math` | `mental-math` |
| 数字广度 | `digit-span` | `digit-span` |
| 多目标追踪 | `multiple-object-tracking` | `mot` |
| 图案推理 | `pattern-completion` | `pattern` |

---

## 2. 积分消费机制

### 2.1 领养宠物

**文件**：`src/utils/petStorage.ts`

- 第一只宠物：免费
- 后续宠物：50 积分/只

```typescript
export const PET_ADOPTION_COST = 50;
```

### 2.2 喂食宠物

**文件**：`src/pages/pet/types.ts`

| 食物 | 价格 | 恢复饥饿值 | 每积分恢复 |
|-----|------|----------|-----------|
| 苹果 🍎 | 5 积分 | 20 | 4.0 |
| 鲜鱼 🐟 | 10 积分 | 40 | 4.0 |
| 大牛排 🥩 | 20 积分 | 100 | 5.0 |

### 2.3 饥饿衰减机制

- 每 15 分钟：1 点饥饿值
- 饥饿上限：100 点
- 饿死时间：饥饿值为 0 后 24 小时

```typescript
export const HUNGER_POINT_PER_MINUTE = 1 / 15;
export const MAX_HUNGER = 100;
export const HOURS_AFTER_ZERO_BEFORE_DEATH = 24;
```

---

## 3. 经济平衡分析

### 3.1 典型玩家每日积分流

| 场景 | 积分变化 |
|------|---------|
| 日常活跃（玩 3 局） | + 约 45-90 积分 |
| 每日喂食 2 次（苹果） | - 10 积分 |
| 每日喂食 3 次（苹果） | - 15 积分 |
| **每日净结余** | **+ 30-75 积分** |

### 3.2 目标达成周期

| 目标 | 所需积分 | 预计天数 |
|-----|---------|---------|
| 领养一只新宠物 | 50 | 1-2 天 |
| 领养所有宠物（5 只） | 200 | 3-7 天 |
| 每日喂养成本 | 10-15 | - |

### 3.3 平衡设计说明

1. **获取 > 消费**：确保玩家有正向激励持续游玩
2. **合理目标周期**：新宠物领养需要 1-2 天，既不太容易也不太难
3. **弹性空间**：高活跃玩家可以积累更多积分，解锁更多宠物
4. **低活跃保护**：即使只玩 1-2 局，也能满足宠物日常喂养需求

---

## 4. 测试验证

### 4.1 积分获取测试

测试文件：`tests/unit/trainingStorage.test.ts`

- ✅ 各游戏转换率正确性
- ✅ 典型分数范围的积分输出在 10-50 之间
- ✅ 边界情况：0 分、负数分、未知 gameId 返回 0

### 4.2 积分消费测试

测试文件：`tests/unit/petStorage.test.ts`

- ✅ 宠物领养成本计算（第一只免费）
- ✅ 喂食消耗与饥饿值恢复
- ✅ 积分不足时消费失败

---

## 5. 代码位置汇总

| 功能 | 文件 | 关键函数/常量 |
|-----|------|-------------|
| 积分转换率 | `src/utils/trainingStorage.ts` | `getAwardedPoints()` |
| 积分获取/消费 | `src/utils/petStorage.ts` | `addPointsToPet()`, `adoptPet()`, `feedPet()` |
| 领养/食物定价 | `src/pages/pet/types.ts` | `PET_ADOPTION_COST`, `FOOD_ITEMS` |
| 饥饿参数 | `src/pages/pet/types.ts` | `HUNGER_POINT_PER_MINUTE`, `MAX_HUNGER` |
| 测试用例 | `tests/unit/trainingStorage.test.ts` | `getAwardedPoints` 测试套件 |

---

**最后更新**：2026-05-21
**版本**：v1.1
