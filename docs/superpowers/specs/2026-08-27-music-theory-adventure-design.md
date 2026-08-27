# 音符小探险设计说明

## 目标

在 Cici 的脑部锻炼中新增一个面向儿童音乐初学者的进阶乐理游戏“音符小探险”。玩家先通过选择题建立基础概念，再把音符拖到五线谱的正确位置，把“知道答案”转化为“会读谱”。每局保持短小、反馈温和、可重复练习。

## 已确认范围

- 采用“绘本冒险 A”视觉方向：星空音乐岛、云朵、星星、彩虹色乐符和友好小向导；所有装饰、五线谱、音符、拖放目标和动画均以 CSS 与 Unicode 音乐符号实现。
- 目录中标为“进阶”，但首版不做章节锁定，玩家可直接开始完整一局。
- 为未来章节解锁预留稳定的章节数据字段和本地进度键，但首版不读取、不写入解锁状态，也不改变目录入口。
- 首版只教学高音谱号 C4–G5；不包括低音谱号、升降记号、调号、连音线、和弦或真实音频听辨。
- 每局固定 8 道选择题和 4 道拖放题，按“先认识、再放置”的顺序完成。
- 游戏参与共享训练记录、宠物积分、官方账号成绩贴图和游戏大闯关；不得创建独立奖励或余额规则。

## 学习路径

### 第一幕：音乐岛知识卡（8 题）

选择题从显性概念到记谱关系推进，正确后展示一句儿童可读的解释，错误后展示正确答案及原因并继续。题库按主题均衡抽取，单局不得出现重复题目。

| 主题 | 首版知识点 | 题目数量 |
| --- | --- | ---: |
| 节拍 | 全、二分、四分音符的相对时值；4/4 拍的一小节含义 | 2 |
| 音符 | A–G 字母音名；C 大调向上音阶顺序 | 2 |
| 音阶 | C 大调从 C 到下一个 C 的七个音名；音阶上行/下行 | 2 |
| 五线谱 | 高音谱号用途；线与间交替；五线谱上 C4–G5 的读法 | 2 |

普通难度提供直白题干和两个明显干扰项；困难难度增加相邻音、反向音阶与节拍组合干扰，但不引入首版范围之外的知识。

### 第二幕：星光五线谱（4 题）

每题显示高音谱号、五条谱线和本题目标音名。玩家从底部候选音符卡中按住并拖到五线谱上的线或间；松手后根据触摸终点命中的离散槽位判断。首版候选位置限于 C4–G5：C4 为下加一线、D4 为下加一间、E4 为第一线、F4 为第一间、G4 为第二线、A4 为第二间、B4 为第三线、C5 为第三间、D5 为第四线、E5 为第四间、F5 为第五线、G5 为第五线之上间。

每题只接受一个目标槽位；未命中谱面、命中相邻槽位或拖拽过程中取消均不计正确。错误时保留题目并给出“音名 + 所在线/间”的提示，玩家可立即再试。

提示按钮只高亮目标线/间并扣除本题分数，不会代替玩家完成拖放。这样让低龄用户能从错误中完成动作学习，而不是被一次误触中断。

## 关卡、状态与数据边界

页面维持现有游戏的 `start`、`playing`、`finished` 三态。`playing` 内通过 `phase: "quiz" | "staff-placement"` 驱动两幕切换；全部题目完成才调用结算。

纯逻辑模块应定义并导出以下稳定数据：

```ts
type MusicTheoryTopic = "rhythm" | "note" | "scale" | "staff";
type MusicTheoryPhase = "quiz" | "staff-placement";
type StaffSlotKind = "ledger-line" | "line" | "space" | "above-space";

interface MusicTheoryQuestion {
  id: string;
  topic: MusicTheoryTopic;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: TrainingDifficulty;
}

interface StaffPlacementLevel {
  id: string;
  chapterId: "music-island-a";
  clef: "treble";
  targetNote: string;
  targetSlotId: string;
  prompt: string;
  explanation: string;
  candidateNotes: string[];
}

interface MusicTheoryScoreInput {
  difficulty: TrainingDifficulty;
  quizCorrectCount: number;
  placementCorrectCount: number;
  hintCount: number;
  elapsedSeconds: number;
  completed: boolean;
}
```

拖放页状态仅在页面中保存当前卡片、手势坐标、被命中的 `targetSlotId` 和本题反馈。命中测试由逻辑模块接收谱面测量值、触摸结束坐标和槽位列表，返回槽位或 `null`，避免把平台触摸细节混入评分逻辑。

为后续章节预留的类型可使用 `MusicTheoryChapter`（`id`、`title`、`isAvailable`、`unlockRequirement`、`quizCount`、`placementCount`）；首版只提供 `music-island-a`，且强制 `isAvailable: true`。不得为未实现的章节写 UI、奖励或假数据。

## 计分、记录与宠物积分

首版游戏分以 40 为普通优秀表现的上限：选择题每题基础 3 分，连续答对或快速完成可获得每题至多 1 分；放置题每题基础 3 分，首次正确和无提示可获得每题至多 2 分。提示每次扣 2 游戏分，最终不得低于 0。普通最高 40，困难最高 50；困难仅改变题库干扰和时间奖励门槛，游戏分仍按同一语义记录。

使用 `gameId: "music-theory"` 和共享的 `TrainingDifficulty`。结算必须依序计算 `getAwardedPoints("music-theory", score, difficulty)`、调用 `addPointsToPet("music-theory", score, difficulty)`、写入 `recordTrainingSession()`。转换率为 `1.0x`，沿用普通 40、困难 60 宠物积分封顶。闯关子局走 `completeGauntletLegIfNeeded()` 并立即返回，不能单独写记录、刷新最高分或发宠物积分。

常规结算页保留 `StickerShareButton`；它只在非闯关时显示，并继续使用已存在的原生成功回调、`postUrl` 去重、每天三次和每次 30 积分规则。

## 交互与可访问性

- 所有可点元素有足够大的触摸区域；拖放同时提供“点选音符卡，再点目标线/间”的等价回退操作，避免手指遮住五线谱造成不可完成。
- 不只依赖颜色：目标槽位使用描边、发光和文字说明，正确/错误状态使用图标和文字。
- 动画遵守应用 `reducedMotion` 设置；CSS 动画在该设置下停用或缩短。
- 五线谱按容器宽度等比绘制，槽位以同一测量模型定位；在窄屏下仍保持线间可触摸。
- 未播放真实音频；仅复用现有点击、正确、错误和完成反馈，并尊重应用声音设置。

## 项目集成

新增页面将进入 `src/app.config.ts`、共享分享表、游戏目录、训练记录 gameId、积分倍率、数据清理键、游戏标题映射和闯关候选池。目录条目是 `reasoning` 分类、`level: "进阶"`、非热门、全量游戏可见并可进入闯关。首页是否展示该条目应与当前 `HOME_GAME_GROUPS` 的容量策略保持一致：首版不额外挤占首页，仍可从“全部游戏”和推荐/闯关进入。

项目不新增图片资产、音频资产或第三方依赖，因此无需 CloudBase 图片上传或 `assets:check`。如果后续确实增加生成的位图角色，必须通过内置 image generation 产出，保存到 CloudBase 资产流程，而不是直接加入小程序包。

## 非目标

- 不做自由作曲、录音、MIDI、真音高识别、键盘演奏、谱面编辑器或联网排行榜。
- 不引入运行时乐谱渲染库；首版五线谱是明确范围内的 CSS 布局，不需要完整 MusicXML 或 VexFlow 能力。
- 不实现低音谱号、升降号、调号、节奏播放或多声部。
