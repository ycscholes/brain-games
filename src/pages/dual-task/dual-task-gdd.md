# 双重任务 (Dual Task) - 完整游戏设计文档

**游戏代号**：DualTask  
**版本**：v1.0  
**平台**：iOS / Android App + 微信小程序  
**类型**：认知训练 / 脑力挑战  
**预计开发难度**：⭐⭐⭐ 中等（状态管理较复杂）

---

## 一、游戏概述

### 1.1 核心机制

同时处理两个认知任务，训练"认知切换"和"注意力分配"能力。

**基础规则**：
- 屏幕分为上下两区，同时显示两个任务
- 两个任务交替或同时出现
- 玩家需要对两个任务分别给出正确答案
- 漏答或答错均扣分

### 1.2 设计理论背景

游戏核心基于 **Stroop 效应**（斯特鲁普效应）——当文字颜色与文字语义冲突时，人的认知处理速度会变慢。这是心理学中测量"执行功能"和"认知控制"的经典范式。

### 1.3 玩家体验目标

| 时长 | 玩家感受 |
|------|---------|
| 0-30秒 | "简单，两个任务而已" |
| 30-60秒 | "有点忙不过来了..." |
| 60-90秒 | "脑子要烧起来了！" |
| 90秒+ | "极限挑战！再来一局！" |

---

## 二、玩法模式详解

### 模式一：交替模式 (Alternating)

**游戏流程**：
```
[上方任务] ← 先显示
   ↓ 0.8s
[下方任务] ← 再显示
   ↓ 0.8s
[上方任务] ← 交替...
```
- 两个任务交替出现
- 玩家依次作答
- 任务切换时有短暂空隙（0.3s）

**计分**：
- 答对：+100分
- 答错/超时：-50分
- 连击加成：每连续答对5题，倍率+0.5

### 模式二：同时模式 (Simultaneous)

**游戏流程**：
```
[上方任务]  [下方任务]
  同时显示，同时作答
```
- 两个任务同时显示在屏幕上下半区
- 玩家必须同时回答两个问题
- 只有全部答对才得分

**计分**：
- 全部答对：+200分（奖励）
- 答错任一：+0分
- 连续全对：倍率递增

### 模式三：Stroop 挑战 (Stroop Challenge)

**核心冲突**：
- 显示颜色词，但用不同颜色书写
- 任务A：说出**文字的含义**（读词）
- 任务B：说出**文字的颜色**（辨色）
- 两者同时出现，玩家需依次回答

**示例**：
```
显示：["红色"（绿色字）] ["蓝色"（红色字）]
      ↑ 上方：选择"红色"  ↓ 下方：选择"红色"
```

**设计意图**：这是最难的模式，完美复现 Stroop 效应，强迫大脑在不同处理通道间切换。

---

## 三、任务类型库

### 任务A：数字判断

| 类型 | 显示内容 | 正确答案 | 选项 |
|------|---------|---------|------|
| 奇偶判断 | "7" | 奇数 | 奇数 / 偶数 |
| 大小判断 | "42" | 大于50？否 | 是 / 否 |
| 简单心算 | "5 + 3" | 8 | 6 / 7 / 8 / 9 |

### 任务B：颜色/图形

| 类型 | 显示内容 | 正确答案 | 选项 |
|------|---------|---------|------|
| 颜色识别 | 🟥 | 红色 | 红/蓝/黄/绿 |
| 形状识别 | ⭐ | 五角星 | 圆形/方形/三角/五角星 |
| 找相同 | 🟥🟦🟥 | 红色 | 红色/蓝色/绿色 |

### Stroop 专用任务

| 任务 | 显示示例 | 正确答案 |
|------|---------|---------|
| 读词 | "绿"（红字）| 绿 |
| 辨色 | "绿"（红字）| 红 |
| 数字-颜色双任务 | 数字"5"+底色🔴 | 5 / 红色 |

---

## 四、UI/UX 详细设计

### 4.1 界面布局（竖屏）

```
┌─────────────────────────┐
│  ⏱️ 00:45  得分: 850   │  ← 顶部状态栏
├─────────────────────────┤
│                         │
│   ┌─────────────────┐   │
│   │   任务A区域     │   │  ← 上半区（45%高度）
│   │   显示内容      │   │
│   │  [选项] [选项]  │   │
│   └─────────────────┘   │
│                         │
│   ┌─────────────────┐   │
│   │   任务B区域     │   │  ← 下半区（45%高度）
│   │   显示内容      │   │
│   │  [选项] [选项]  │   │
│   └─────────────────┘   │
│                         │
├─────────────────────────┤
│  任务A: ✅  任务B: ⏳   │  ← 底部状态（同时模式用）
└─────────────────────────┘
```

### 4.2 组件设计

#### 顶部状态栏
- **计时器**：圆形进度条 + 数字倒计时（45秒/60秒/90秒）
- **得分**：实时跳动数字
- **连击显示**：🔥×5 形式

#### 任务卡片
```
┌─────────────────────┐
│      🔢 数字        │  ← 任务类型图标
│                     │
│         7           │  ← 题目内容（大字）
│                     │
│  ┌─────┐  ┌─────┐  │
│  │奇数 │  │偶数 │  │  ← 按钮组
│  └─────┘  └─────┘  │
└─────────────────────┘

高度：180pt
圆角：16pt
背景：#FFFFFF / 阴影：0 4px 12px rgba(0,0,0,0.1)
选中态：scale(0.95) + 背景变深
```

#### 交替模式过渡动画
- 任务A淡出（200ms）→ 任务B淡入（200ms）
- 有轻微上下滑动效果（translateY: 10px）

### 4.3 颜色规范

| 用途 | 颜色 | Hex |
|------|------|-----|
| 主色 | 科技蓝 | #4A90D9 |
| 背景 | 浅灰 | #F5F7FA |
| 卡片背景 | 白色 | #FFFFFF |
| 正确 | 绿色 | #34C759 |
| 错误 | 红色 | #FF3B30 |
| 警告/超时 | 橙色 | #FF9500 |
| 文字主色 | 深灰 | #1C1C1E |
| 文字次色 | 中灰 | #8E8E93 |

### 4.4 字体规范

| 元素 | 字号 | 字重 | 颜色 |
|------|-----|------|------|
| 得分数字 | 32pt | Bold | #1C1C1E |
| 题目内容 | 64pt | Bold | #1C1C1E |
| 任务类型标签 | 14pt | Medium | #8E8E93 |
| 按钮文字 | 20pt | Semibold | #FFFFFF |
| 倒计时 | 18pt | Medium | #FF9500 |

### 4.5 交互反馈

| 事件 | 视觉反馈 | 触觉反馈 |
|------|---------|---------|
| 按钮按下 | scale(0.95) 缩放 | 短震动 10ms |
| 答对 | 绿色闪光 + 数字跳动 | 轻震动 20ms |
| 答错 | 红色抖动 + 正确答案高亮 | 强震动 50ms |
| 超时 | 灰色fade + ✗图标 | 警告震动 30ms |
| 连击突破5 | 火焰动画 + 屏幕边缘光 | 连续震动 |

---

## 五、数据结构

### 5.1 游戏配置 (GameConfig)

```typescript
interface GameConfig {
  // 模式选择
  mode: 'alternating' | 'simultaneous' | 'stroop';
  
  // 难度
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
  
  // 时长（秒）
  duration: 45 | 60 | 90;
}
```

### 5.2 任务定义 (Task)

```typescript
type TaskType = 
  | 'odd_even'      // 奇偶判断
  | 'greater_than'  // 大小判断
  | 'simple_math'  // 简单心算
  | 'color_match'   // 颜色识别
  | 'shape_match'   // 形状识别
  | 'find_same'     // 找相同
  | 'stroop_read'   // Stroop读词
  | 'stroop_color'; // Stroop辨色

interface Task {
  id: string;
  type: TaskType;
  question: string;        // 显示内容
  options: string[];       // 选项数组
  correctAnswer: number;   // 正确答案索引
  timeLimit: number;       // 该题时限(ms)
  pointValue: number;      // 基础分值
}

interface TaskPair {
  taskA: Task;
  taskB: Task;
  displayMode: 'sequential' | 'simultaneous';
  gapTime: number;         // 交替间隔(ms)
}
```

### 5.3 游戏状态 (GameState)

```typescript
interface GameState {
  // 基础状态
  status: 'idle' | 'playing' | 'paused' | 'finished';
  
  // 计时
  timeRemaining: number;   // 剩余秒数
  currentTaskIndex: number;
  
  // 分数
  score: number;
  streak: number;
  multiplier: number;
  
  // 统计
  correctCount: number;
  wrongCount: number;
  timeoutCount: number;
  
  // 当前题目
  currentTaskPair: TaskPair | null;
  taskAAnswered: boolean;
  taskBAnswered: boolean;
  taskAAnswer: number | null;
  taskBAnswer: number | null;
}
```

### 5.4 本地存储 (LocalStorage)

```typescript
interface LocalStorage {
  // 各模式最高分
  bestScore_alternating: number;
  bestScore_simultaneous: number;
  bestScore_stroop: number;
  
  // 各难度最高分（可选）
  bestScore_alternating_easy: number;
  bestScore_alternating_normal: number;
  bestScore_alternating_hard: number;
  
  // 游戏统计
  totalGamesPlayed: number;
  totalCorrectAnswers: number;
  longestStreak: number;
  
  // 设置
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onboardingCompleted: boolean;
}
```

---

## 六、难度系统

### 6.1 难度参数表

| 难度 | 任务间隔 | 时长 | 题目数 | 超时惩罚 | 解锁条件 |
|------|---------|------|-------|---------|---------|
| 🟢 简单 | 1.5s | 60s | ~25题 | -20分 | 默认开放 |
| 🟡 普通 | 1.0s | 60s | ~35题 | -30分 | 简单得分≥500 |
| 🔴 困难 | 0.7s | 45s | ~40题 | -50分 | 普通得分≥600 |
| 🟣 专家 | 0.5s | 45s | ~50题 | -50分 | 困难得分≥700 |

### 6.2 题目难度分布

| 难度 | 简单题 | 中等题 | 困难题 |
|------|-------|-------|-------|
| 简单 | 80% | 20% | 0% |
| 普通 | 50% | 40% | 10% |
| 困难 | 20% | 50% | 30% |
| 专家 | 0% | 40% | 60% |

### 6.3 具体题目参数

#### 奇偶判断
```
简单：1-10 的数字
普通：1-50 的数字  
困难：1-100 的数字
专家：1-200 的数字
```

#### 大小判断
```
简单：与 10 比较
普通：与 50 比较
困难：与 100 比较
专家：与 100 比较（数字更大）
```

#### 简单心算
```
简单：一位数 ± 一位数（结果 ≤10）
普通：一位数 ±× 一位数
困难：两位数 ± 一位数
专家：两位数 ±× 两位数
```

---

## 七、分数系统

### 7.1 得分公式

```
单题得分 = 基础分 × 速度系数 × 连击倍率

基础分：
  - 交替模式答对：100分
  - 同时模式全对：200分
  - Stroop模式：150分/任务

速度系数（剩余时间比例）：
  > 70%: ×1.5 （神速）
  40-70%: ×1.2 （快速）
  20-40%: ×1.0 （正常）
  < 20%: ×0.8 （勉强）

连击倍率：
  0-4 连击: ×1.0
  5-9 连击: ×1.3
  10-19 连击: ×1.5
  20+ 连击: ×2.0
```

### 7.2 惩罚机制

```
超时/答错：-50分（基础）
           × 当前连击倍率（连击越高惩罚越大）
           最低惩罚：-20分

连续错误：连续3次错误，强制跳过1题（给玩家喘息）
```

### 7.3 结算界面数据

```typescript
interface GameResult {
  // 基础数据
  finalScore: number;
  isNewBestScore: boolean;
  previousBestScore: number;
  
  // 正确率
  accuracy: number;           // 正确率百分比
  totalQuestions: number;
  correctAnswers: number;
  
  // 连击
  longestStreak: number;
  averageStreak: number;
  
  // 速度
  averageResponseTime: number; // 平均反应时间(ms)
  fastestResponse: number;     // 最快反应时间(ms)
  
  // 模式特有
  simultaneousFullCorrect: number; // 同时模式全对次数
  stroopConflictCount: number;      // Stroop冲突次数
}
```

---

## 八、动画详细规范

### 8.1 任务切换动画

**交替模式任务切换**：
```javascript
// 任务A退出
taskA.style.transition = 'all 200ms ease-out';
taskA.style.opacity = '0';
taskA.style.transform = 'translateY(-10px)';

// 300ms后任务B进入
taskB.style.transition = 'all 200ms ease-in';
taskB.style.opacity = '1';
taskB.style.transform = 'translateY(0)';
```

### 8.2 分数跳动动画

```javascript
// 答对时分数增加
scoreElement.animate([
  { transform: 'scale(1)' },
  { transform: 'scale(1.2)' },
  { transform: 'scale(1)' }
], {
  duration: 300,
  easing: 'ease-out'
});

// 飘字 "+100"
floatingText.animate([
  { opacity: 1, transform: 'translateY(0)' },
  { opacity: 0, transform: 'translateY(-30px)' }
], {
  duration: 800,
  easing: 'ease-out'
});
```

### 8.3 连击动画

```javascript
// 火焰效果（达到5连击时）
streakFire.animate([
  { opacity: 0, transform: 'scale(0.5)' },
  { opacity: 1, transform: 'scale(1.2)' },
  { transform: 'scale(1)' }
], {
  duration: 400,
  easing: 'back-out'
});

// 屏幕边缘发光（达到10连击时）
screenGlow.style.animation = 'pulse-glow 1s infinite';
```

### 8.4 错误抖动

```javascript
// 答错时卡片抖动
errorCard.animate([
  { transform: 'translateX(0)' },
  { transform: 'translateX(-8px)' },
  { transform: 'translateX(8px)' },
  { transform: 'translateX(-5px)' },
  { transform: 'translateX(5px)' },
  { transform: 'translateX(0)' }
], {
  duration: 400,
  easing: 'ease-in-out'
});
```

---

## 九、状态机设计

### 9.1 游戏状态机

```
┌─────────┐
│  IDLE   │  ← 初始状态
└────┬────┘
     │ [点击开始]
     ↓
┌─────────┐
│ PLAYING │  ← 进行中
│         │
│ [任务显示] → [玩家作答] → [判定] → [下一题/结算]
│         │
│ [暂停] ──────→ PAUSED
│         │
│ [时间到/全部完成] → FINISHED
└────┬────┘
     │ [查看结果/再来一局]
     ↓
┌─────────┐
│ RESULT  │  ← 结果展示
└────┬────┘
     │ [返回主页/再来一局]
     ↓
   IDLE
```

### 9.2 题目状态机（单题）

```
┌────────────┐
│  WAITING   │  ← 等待显示
└─────┬──────┘
      │ [显示任务]
      ↓
┌────────────┐
│  DISPLAYED │  ← 已显示，等待作答
│            │
│ [玩家点击] → CHECKING
│ [超时]     → TIMEOUT
└─────┬──────┘
      │
      ↓
┌────────────┐   [正确]   ┌─────────┐
│  CHECKING  │ ─────────→ │ CORRECT │
└─────┬──────┘            └────┬────┘
      │ [错误]                   │
      ↓                         │
┌────────────┐                   │
│   ERROR    │ ←────────────┘
└────────────┘
```

---

## 十、音效设计

### 10.1 音效列表

| 事件 | 音效描述 | 时长 | 文件格式 |
|------|---------|------|---------|
| 题目出现 | 轻微"叮"声 | 100ms | mp3 |
| 按钮点击 | 短促"嗒"声 | 50ms | mp3 |
| 答对 | 清脆上升音阶 | 200ms | mp3 |
| 答错 | 低沉下降音 | 300ms | mp3 |
| 连击突破 | 欢呼/金币响 | 400ms | mp3 |
| 超时 | 警告音 | 250ms | mp3 |
| 游戏结束 | 总结音效 | 500ms | mp3 |
| 背景音乐 | 轻快循环 | 60s循环 | mp3 |

### 10.2 音量建议

- 音效音量：60% - 80%
- 背景音乐：30% - 40%
- 震动反馈：作为音效的补充

---

## 十一、技术实现建议

### 11.1 框架选择

| 平台 | 推荐框架 | 理由 |
|------|---------|------|
| 微信小程序 | 原生 / Taro / uni-app | 轻量，发布快 |
| App (iOS/Android) | React Native / Flutter | 跨平台，热更新 |
| 快速原型 | React + Vite | 开发效率高 |

### 11.2 状态管理建议

```javascript
// React Native / 微信小程序 状态管理
const initialState = {
  gameStatus: 'idle',
  score: 0,
  streak: 0,
  timeRemaining: 60,
  currentTaskPair: null,
  taskAAnswered: false,
  taskBAnswered: false,
};

// 使用 useReducer 或 Redux
function gameReducer(state, action) {
  switch (action.type) {
    case 'START_GAME':
      return { ...state, gameStatus: 'playing', ...initialState };
    
    case 'SHOW_TASK':
      return { ...state, currentTaskPair: action.payload };
    
    case 'ANSWER_TASK_A':
      return { 
        ...state, 
        taskAAnswered: true, 
        taskAAnswer: action.payload,
        score: calculateScore(state, action.payload, 'A')
      };
    
    case 'TICK':
      return { 
        ...state, 
        timeRemaining: state.timeRemaining - 1 
      };
      
    case 'GAME_OVER':
      return { ...state, gameStatus: 'finished' };
      
    default:
      return state;
  }
}
```

### 11.3 题目生成算法

```javascript
// 题目生成器
class TaskGenerator {
  constructor(difficulty) {
    this.difficulty = difficulty;
  }
  
  // 生成奇偶判断题
  generateOddEven() {
    const range = this.getNumberRange(); // 根据难度返回范围
    const number = random(range.min, range.max);
    
    return {
      type: 'odd_even',
      question: number.toString(),
      options: ['奇数', '偶数'],
      correctAnswer: number % 2 === 0 ? 1 : 0,
      timeLimit: this.getTimeLimit(),
      pointValue: 100
    };
  }
  
  // 生成颜色匹配题
  generateColorMatch() {
    const colors = ['红', '蓝', '黄', '绿'];
    const correct = randomItem(colors);
    
    return {
      type: 'color_match',
      question: correct,  // 显示颜色emoji或文字
      options: colors,
      correctAnswer: colors.indexOf(correct),
      timeLimit: this.getTimeLimit(),
      pointValue: 100
    };
  }
  
  // 生成Stroop题目
  generateStroop() {
    const colors = ['红', '蓝', '黄', '绿'];
    const word = randomItem(colors);
    const ink = randomItem(colors);
    
    // 随机决定是读词还是辨色
    const isReadTask = Math.random() > 0.5;
    
    return {
      type: isReadTask ? 'stroop_read' : 'stroop_color',
      question: word,
      inkColor: ink,
      options: colors,
      correctAnswer: isReadTask 
        ? colors.indexOf(word) 
        : colors.indexOf(ink),
      timeLimit: this.getTimeLimit() * 1.2, // Stroop题多给20%时间
      pointValue: 150
    };
  }
  
  getNumberRange() {
    switch (this.difficulty) {
      case 'easy': return { min: 1, max: 10 };
      case 'normal': return { min: 1, max: 50 };
      case 'hard': return { min: 1, max: 100 };
      case 'expert': return { min: 1, max: 200 };
    }
  }
  
  getTimeLimit() {
    switch (this.difficulty) {
      case 'easy': return 1500;
      case 'normal': return 1000;
      case 'hard': return 700;
      case 'expert': return 500;
    }
  }
}
```

### 11.4 倒计时逻辑

```javascript
// 游戏计时器Hook
function useGameTimer(initialTime, onTick, onEnd) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  
  useEffect(() => {
    if (timeRemaining <= 0) {
      onEnd();
      return;
    }
    
    const timer = setTimeout(() => {
      setTimeRemaining(t => t - 1);
      onTick();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeRemaining]);
  
  return timeRemaining;
}

// 题目级别倒计时（用于判断速度系数）
function useQuestionTimer(timeLimit, onTimeout) {
  const [remaining, setRemaining] = useState(timeLimit);
  const startTimeRef = useRef(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const left = Math.max(0, timeLimit - elapsed);
      setRemaining(left);
      
      if (left <= 0) {
        clearInterval(interval);
        onTimeout();
      }
    }, 50); // 50ms精度检查
    
    return () => clearInterval(interval);
  }, [timeLimit]);
  
  // 计算速度系数
  const getSpeedMultiplier = () => {
    const ratio = remaining / timeLimit;
    if (ratio > 0.7) return 1.5;
    if (ratio > 0.4) return 1.2;
    if (ratio > 0.2) return 1.0;
    return 0.8;
  };
  
  return { remaining, getSpeedMultiplier };
}
```

---

## 十二、测试检查清单

### 功能测试
- [ ] 交替模式：任务正确交替显示
- [ ] 同时模式：两个任务同时显示
- [ ] Stroop模式：正确显示冲突效果
- [ ] 答题判定：正确识别对错
- [ ] 计时器：倒计时准确
- [ ] 分数计算：各种加成正确应用
- [ ] 连击系统：正确累计和重置
- [ ] 暂停/恢复：状态正确保存
- [ ] 最高分：正确存储和读取
- [ ] 设置：音效/震动开关有效

### 边界测试
- [ ] 极快点击（防抖）
- [ ] 同时点击两个选项
- [ ] 超时后继续操作
- [ ] 网络中断（本地存储）
- [ ] App切到后台再切回
- [ ] 低电量模式

### 体验测试
- [ ] 新手引导是否清晰
- [ ] 难度梯度是否合理
- [ ] 动画流畅度（60fps）
- [ ] 触觉反馈时机
- [ ] 颜色对比度（无障碍）

---

## 十三、开发里程碑

| 阶段 | 内容 | 预计工时 |
|------|------|---------|
| Phase 1 | 核心框架 + 交替模式 | 4-6小时 |
| Phase 2 | 同时模式 + Stroop模式 | 3-4小时 |
| Phase 3 | 动画/音效/震动反馈 | 3-4小时 |
| Phase 4 | 存储/统计/设置 | 2-3小时 |
| Phase 5 | 难度调整 + Bug修复 | 2-3小时 |
| **总计** | | **14-20小时** |

---

## 附录：示例题目数据

### 简单难度 - 交替模式示例

```json
{
  "taskA": {
    "type": "odd_even",
    "question": "7",
    "options": ["奇数", "偶数"],
    "correctAnswer": 0,
    "timeLimit": 1500,
    "pointValue": 100
  },
  "taskB": {
    "type": "color_match", 
    "question": "🟥",
    "options": ["红", "蓝", "黄", "绿"],
    "correctAnswer": 0,
    "timeLimit": 1500,
    "pointValue": 100
  }
}
```

### 困难难度 - Stroop模式示例

```json
{
  "taskA": {
    "type": "stroop_read",
    "question": "绿",
    "inkColor": "红",
    "options": ["红", "蓝", "黄", "绿"],
    "correctAnswer": 3,
    "timeLimit": 840,
    "pointValue": 150
  },
  "taskB": {
    "type": "stroop_color",
    "question": "蓝",
    "inkColor": "黄",
    "options": ["红", "蓝", "黄", "绿"],
    "correctAnswer": 2,
    "timeLimit": 840,
    "pointValue": 150
  }
}
```

---

*文档版本：v1.0*  
*可直接用于开发，实现时注意 `[占位符]` 部分需根据测试调整*
