# 车阵突围：十种车辆外观与 v6 图集

## 目标

在不改变棋盘题面、点击范围、移动规则、解法、难度、得分或宠物积分的前提下，将车辆外观池从 6 种扩展到 10 种：新增 2 辆两格车和 2 辆三格车。新增两格车中恰有一辆是粉红色跑车。

## 车辆与视觉方向

保留当前圆润、高饱和、儿童训练游戏的车辆风格；红色目标车继续固定为现有 `sport`，以保持最高视觉优先级。

新增车型采用已确认的明快对比配色：

- 两格：`pink-sport`（粉红色跑车）、`offroad-suv`（青绿越野车）。粉红跑车只会分配给非目标车辆。
- 三格：`camper-rv`（紫蓝房车）、`tanker-truck`（青柠罐车）。

## 图集与远端资源

将单张透明图集升级为 5 列 × 2 行、`3840 × 640` 的 `v6` 资源。每列宽 768 像素：上行槽位为 `768 × 384` 的两格车，下行槽位为 `768 × 256` 的三格车。列顺序固定为：

| 行 | 第 0 列 | 第 1 列 | 第 2 列 | 第 3 列 | 第 4 列 |
| --- | --- | --- | --- | --- | --- |
| 两格 | `sport` | `compact-van` | `city-taxi` | `pink-sport` | `offroad-suv` |
| 三格 | `city-bus` | `box-truck` | `stretch-sedan` | `camper-rv` | `tanker-truck` |

资源仍保存为 `asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png`，但上传至版本化路径 `assets/games/traffic-escape/v6/vehicle-atlas.png`。不可覆盖 v5。生成资产须通过内置图像生成工具制作，去除 chroma-key 背景后检查 alpha、边缘、小尺寸可读性和车头方向；最终槽位的 `visibleBounds` 由 alpha 实测得出。

## 数据与渲染

`gameLogic.ts` 将两种长度的外观池各扩展到 5 个成员。目标车继续固定 `sport`；同一长度的普通车在外观池耗尽前不重复。当前常见题面含 5 辆两格车（含目标车）和 3 辆三格车，因此两格车每局覆盖五种外观，三格车从五种中无重复抽取三种。

`vehicleAtlas.ts` 泛化为 5 列，裁切层使用 `background-size: 500% auto`；彩色图层与黑色网格遮罩始终从同一裁切样式派生。各列位置、可见范围和校正由图集常量计算；保留三格车的光学居中校正。`index.tsx` 和 `index.scss` 只调整展示文案与图集大小，继续复用既有横竖旋转、选中态、提示态和降级轮廓。

## 不变项

- 不修改 `NORMAL_PUZZLES`、`HARD_PUZZLES`、布局生成、BFS、碰撞或 `DIFFICULTY_REQUIREMENTS`。
- 不修改积分管线、游戏目录注册或奖励配置。
- 不增加每局实体车辆；这是一项外观池扩展。
- 不触碰未跟踪的 `output/`。

## 测试与验收

先扩展游戏逻辑、图集裁切和远端资源映射测试，再实施代码与资源。测试应证明：

1. 两个外观池均为 5 种，目标车保持 `sport`，`pink-sport` 在两格非目标车中恰好一次；三格车从 5 种中无重复抽取当前所需数量。
2. 10 个槽位具有正确长度限制、第五列裁切位置和 `500% auto` 背景大小；彩色层、遮罩层、横竖状态、选中态及三格光学校正一致。
3. v6 远端路径仅解析一个图集 URL；资源失效时仍保留可见降级轮廓。
4. 普通与困难题面保持可解、密度与最低解步数不变；横竖新增车型的占格边界、选中描边、提示动画和三格居中经视觉检查通过。

验证命令依次为：相关单元测试、`npm run assets:check`、全量 `npm test -- --runInBand`、`npm run typecheck`、`npm run lint`、`npm run build:weapp`、`npm run secrets:check` 和 `git diff --check`。资源检查通过后上传 v6，并确认 CloudBase 解析的实际路径是 v6。
