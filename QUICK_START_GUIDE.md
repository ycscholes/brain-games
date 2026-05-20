# cici-brain-training 项目开发快速上手指南 (v1.2.0)

## 1. 核心技术栈
- **框架**: Taro 4.x (React 18)
- **样式**: Tailwind CSS + SCSS
- **语言**: TypeScript (严格模式)

## 2. 核心规则 (Must)
以下规则若违反将导致 CI 失败或无法提交代码：

1. **禁用 any**: 严禁使用 `any` 类型。若遇第三方库缺失类型，请使用 `// TODO: fix type` 并联系 Lead。
2. **异步安全**: 所有 `await` 操作必须包裹在 `try-catch` 中，并提供用户反馈（如 `Taro.showToast`）。
3. **消除魔法值**: 禁止直接使用数字/字符串。请统一定义在 `@/constants` 中。
4. **组件命名**: 统一使用 `PascalCase` 命名组件文件，如 `UserCard.tsx`。
5. **AI 修改后必须提交**: 大模型或 AI Assistant 完成代码修改后，必须运行必要校验，并用 `git commit` 形成独立提交；不得混入无关的既有工作区改动。

## 3. 推荐实践 (Should)
- **生命周期**: 页面初始化优先使用 `useLoad` 获取参数。
- **路径引用**: 优先使用 `@/` 别名引用资源。
- **原子化样式**: 优先使用 Tailwind CSS 类名，减少冗余 SCSS。

## 4. 自动化工具
- **本地校验**: 提交代码时 `husky` 会自动运行 `project_rules_validator.js`。
- **CI 监控**: PR 提交后 GitHub Actions 会执行 `rules-compliance` 扫描。

## 5. AI Assistant 交付流程

1. 修改前使用 `git status --short` 确认工作区已有改动。
2. 修改后运行与本次变更相关的校验，例如 `npm run typecheck`、`npm test` 或构建命令。
3. 使用 `git diff --name-only` 确认只提交本次任务相关文件。
4. 使用 `git add <相关文件>` 精确暂存。
5. 使用清晰的 conventional commit 信息提交，例如 `docs: update AI coding workflow rules`。
6. 若校验失败或无法提交，必须在交付说明中写明命令、原因和影响范围。

---
*如有规则疑问，请咨询 Tech Lead 或提交 Issue 修改 project_rules.md*
