# 验证与题库认证

本文记录仓库当前可审查的验证命令、认证触发条件和证据边界。命令的实际定义以 `package.json` 为准。

## 默认验证

### `npm test`

`npm test` 运行 Jest 默认单元测试套件。它是快速、确定性的回归入口，并通过 Jest 路径过滤排除 `tests/certification/`；当前工作区基线约为 **49 秒**，实际耗时会随机器和依赖状态变化。默认套件不会隐式执行车阵突围的完整题库 BFS 或 2,000-seed 扫描。

### `npm run verify`

`npm run verify` 按以下顺序执行：

1. `npm test`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run assets:check`
5. `npm run audio:check`
6. `npm run secrets:check`
7. `git diff --check`

该聚合命令**不会**运行 `npm run test:puzzle-certification`，也不会执行 `npm run build:weapp`、素材上传、音频上传、云函数部署或其他部署动作。它是提交前的本地代码与资源检查，不等同于线上或设备验收。

## 车阵突围题库认证

### `npm run test:puzzle-certification`

该命令显式运行 `tests/certification/`，覆盖完整困难题库认证、题库结构和生成器扫描。当前基线约需 **11 分钟**（Task 4 的一次完整运行约 664 秒）；因此它不属于默认 `npm test` 或 `npm run verify`，不能把默认测试耗时理解成包含这套认证。

当下列任一内容发生变化时，必须运行 `npm run test:puzzle-certification`：

- Traffic Escape generator（包括 `src/pages/traffic-escape/puzzleGenerator.ts` 或其生成/选择逻辑）；
- Traffic Escape quality rules（包括 `src/pages/traffic-escape/puzzleQuality.ts` 或认证规则）；
- 生成的困难题库 `src/pages/traffic-escape/hardPuzzles.generated.ts`。

如果只修改与 Traffic Escape 题库无关的代码，可按改动范围运行默认测试和 `npm run verify`；但发布或合并涉及上述任一文件时，必须保留这次显式认证的通过记录。

## 构建与真实运行证据

`npm run build:weapp` 只证明 Taro 能生成微信小程序构建产物。它不证明微信开发者工具中的页面加载、云端资源访问、导航交互、授权流程或任何真机行为。开发者工具预览、真机测试和线上发布属于独立的运行证据，不能用构建成功替代。

`npm run test:puzzle-certification` 和 `npm run verify` 都是本地检查；它们不上传、不部署，也不产生线上验收证据。

## 架构文档入口

README 中的 [架构指南](architecture.md)链接预留给后续 Task 11；当前正文尚未落地，不能据此声称架构文档已存在或已完成。
