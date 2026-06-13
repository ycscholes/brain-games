# Cici的脑部锻炼

Cici的脑部锻炼是一个基于 Taro 和 React 的微信小程序脑力训练项目。项目通过短时小游戏训练计算、工作记忆、抑制控制、视觉追踪、规律推理和多任务处理，并用统一的训练记录与宠物积分系统连接长期使用体验。

## 游戏清单

| 游戏 | 训练方向 | 路由 | 说明 |
| --- | --- | --- | --- |
| 速算挑战 | 计算速度与准确性 | `/pages/mental-math/index` | [游戏说明](src/pages/mental-math/README.md) |
| 找规律 | 多规则视觉推理 | `/pages/pattern-completion/index` | [游戏说明](src/pages/pattern-completion/README.md) |
| 数字广度记忆 | 短时数字记忆 | `/pages/digit-span/index` | [游戏说明](src/pages/digit-span/README.md) |
| 24 点 | 算术组合 | `/pages/twenty-four/index` | [游戏说明](src/pages/twenty-four/README.md) |
| 逆向猜拳 | 抑制控制与反应 | `/pages/rock-paper-scissors/index` | [游戏说明](src/pages/rock-paper-scissors/README.md) |
| 星链回响 | 路径工作记忆 | `/pages/number-order/index` | [游戏说明](src/pages/number-order/README.md) |
| 奇趣图形记忆 | N-Back 图形记忆 | `/pages/memory-challenge/index` | [游戏说明](src/pages/memory-challenge/README.md) |
| 追踪任务 | 多目标视觉追踪 | `/pages/multiple-object-tracking/index` | [游戏说明](src/pages/multiple-object-tracking/README.md) |
| 农场清点 | 选择性计数与动态计数 | `/pages/bird-count/index` | [游戏说明](src/pages/bird-count/README.md) |
| 多任务处理 | 持续控制与任务切换 | `/pages/dual-task/index` | [游戏说明](src/pages/dual-task/README.md) |
| 词语拼盘 | 语言重组与词义匹配 | `/pages/word-scramble/index` | [游戏说明](src/pages/word-scramble/README.md) |

`词语拼盘` 当前未在首页展示，但页面、训练记录和积分管线仍然可用。`/pages/head-count/index` 是农场清点中“农场进出”模式的[兼容路由](src/pages/head-count/README.md)。

## 核心系统

- 首页：游戏分类、搜索、训练摘要、推荐游戏和宠物入口。
- 训练记录：统一保存游戏、分数、积分、难度、模式、时长和完成状态。
- 宠物小院：使用训练积分领养和喂养宠物，详见[宠物模块说明](src/pages/pet/README.md)。
- 云同步：本地数据发生变化后，通过 CloudBase 云函数同步用户快照。
- 远程素材：宠物和食物等可复用图片存放于 CloudBase Storage，仓库仅保留源文件备份。

积分换算、难度倍率、单局上限和宠物经济的权威规则见 [docs/points-economy.md](docs/points-economy.md)。

## 技术栈

- Taro 4
- React 18
- TypeScript 5
- SCSS、Tailwind CSS、weapp-tailwindcss
- Jest
- CloudBase 云函数、云存储和用户数据同步
- 腾讯 AIArt 图生图（AI 自定义宠物）

运行环境要求 Node.js 22，版本记录在 `.nvmrc`。

## 项目结构

```text
src/pages/                    页面、游戏实现及对应说明
src/utils/                    训练记录、积分、宠物存储、分享和资源预加载
src/services/user-data/       本地数据仓库、事件通知和云同步
src/config/                   远程素材地址解析
cloudfunctions/               登录、读取与同步用户数据的云函数
tests/unit/                   纯逻辑与存储单元测试
docs/                         长期维护的全局规则和候选池
docs/superpowers/generation/  图片生成流程与提示词
asset-backups/                CloudBase 远程图片的 Git 源文件备份
```

## 环境配置

安装依赖前切换到 Node.js 22：

```bash
nvm use
npm install
```

复制 `.env.example` 为 `.env.development.local`、`.env.production.local` 或 `.env.test.local`，再按目标环境填写配置。CloudBase 相关配置包括：

- `TARO_CLOUD_ENV_ID`
- `TARO_CLOUD_STORAGE_BUCKET`
- `TARO_REMOTE_ASSETS_PUBLIC`：生产素材桶确认“所有用户可读”后设为 `true`

AI 自定义宠物的 `customPetWorker` 需要可调用腾讯混元生图 `ImageToImage` 的服务身份。推荐给云函数绑定最小权限角色；也可在函数环境变量中配置 `TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY` 和可选的 `TENCENTCLOUD_AI_REGION`。

不要在文档或提交中写入真实标识、密钥或云环境名称。微信小程序 App ID 写入被忽略的 `project.private.config.json`，云环境配置只写入 `.env.*.local`。提交前运行 `npm run secrets:check`；本地提交钩子和 GitHub Actions 会重复执行检查。

## 开发命令

```bash
npm run dev:weapp       # 微信小程序监听构建
npm run dev:h5          # H5 监听构建
npm run build:weapp     # 微信小程序生产构建
npm run build:h5        # H5 生产构建
npm run lint            # ESLint 与项目规则检查
npm run typecheck       # TypeScript 类型检查
npm test                # Jest 单元测试
npm run assets:check    # 校验 CloudBase 远程图片备份
npm run assets:upload   # 上传远程图片，需要有效云环境配置
npm run deploy:cloudfunctions # 部署云函数与自定义宠物恢复定时器
```

部署脚本会使用 `Nodejs20.19` 部署自定义宠物 Worker、把超时设为 900 秒，并确保恢复函数每五分钟运行一次。

宠物素材使用 `config/remote-assets.json` 中的版本化目录。替换图片时应提升版本号并上传到新目录，不要覆盖线上同一路径文件，以避免 CDN 和客户端继续使用旧缓存。

`TARO_REMOTE_ASSETS_PUBLIC` 默认保持 `false`。只有 CloudBase 存储规则已成功切换为公有读并验证匿名访问后才能启用；部分套餐不允许修改存储安全规则，此时继续使用自动续期的临时链接。

提交代码前至少运行与改动相关的检查。项目禁止显式 `any`，异步调用需要遵守项目规则校验器的错误处理约束。

## 数据与积分

游戏结束时使用统一流程：

1. `getAwardedPoints()` 根据游戏分数、基础转换率和难度计算宠物积分。
2. `addPointsToPet()` 将同一口径的积分写入宠物余额。
3. `recordTrainingSession()` 保存训练记录。

普通难度单局最多 40 积分，困难难度使用 1.5 倍倍率且最多 60 积分。页面不得自行实现积分倍率或封顶逻辑。

本地数据由 `src/services/user-data/` 统一汇总并同步。清除产品数据、兼容旧存储键和训练 ID 别名的逻辑集中在 `src/utils/trainingStorage.ts`。

## 远程图片

会显著增加小程序包体的宠物、食物和复用图片存放在 `asset-backups/cloudbase-images/`，运行时通过 `src/config/remoteAssets.ts` 加载 CloudBase Storage 地址。

新增或替换图片时：

1. 遵循 [图片生成与验收流程](docs/superpowers/generation/image-gen-asset-workflow.md)。
2. 更新 `asset-backups/cloudbase-images/` 下的源文件。
3. 运行 `npm run assets:check`。
4. 需要刷新云端副本时运行 `npm run assets:upload`。

## 文档维护

- 根 README 负责项目总览与开发入口。
- 每个游戏目录的 README 是该游戏当前规则的唯一说明。
- [积分系统](docs/points-economy.md)维护跨游戏奖励规则。
- [游戏候选池](docs/game-candidate-pool.md)只记录尚未实现的候选方向。
- 已落地的临时设计稿和实施计划不长期保留；当前代码、测试和长期规则文档优先。
