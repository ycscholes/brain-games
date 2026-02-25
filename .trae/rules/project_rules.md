# Project Development Rules - xiaoyuyuan

| 版本   | 修订日期   | 修订人       | 变更摘要                                           |
| :----- | :--------- | :----------- | :------------------------------------------------- |
| v1.0.0 | 2025-01-01 | System       | 初始版本 (Next.js 模板)                            |
| v1.1.0 | 2026-02-12 | AI Assistant | 适配 Taro 4.x 技术栈，重构规则体系，增加自动化校验 |

## 1. 核心技术栈规范

### 1.1 框架与运行时 (Must)

- **描述**: 项目基于 Taro 4.x 框架，使用 React 18 进行多端开发（小程序/H5）。
- **示例**:
  - ✅ `import { View } from '@tarojs/components';`
  - ❌ `import { div } from 'react-dom';` (小程序不支持原生 HTML 标签)
- **例外**: 仅在纯 H5 页面且经 Tech Lead 审批后可使用 Web 特有 API。

### 1.2 样式方案 (Must)

- **描述**: 优先使用 Tailwind CSS 进行布局与原子化样式开发，复杂交互动画使用 SCSS。
- **示例**:
  - ✅ `<View className="flex items-center p-4">...</View>`
  - ❌ 使用 `styled-components` (本项目未引入且不利于小程序性能)。
- **例外**: 无。

### 1.3 语言标准 (Must)

- **描述**: 全量使用 TypeScript，严禁显式使用 `any` 类型。必须开启 `strict` 模式。
- **示例**:
  - ✅ `const handleSort = (data: Item[]): void => { ... }`
  - ❌ `const handleSort = (data: any) => { ... }`
- **例外**: 第三方库定义缺失且无法通过声明文件补充时，可临时使用 `any` 但需标注 `// TODO: fix type`。

## 2. 代码风格与命名

### 2.1 命名规范 (Must)

- **描述**: 组件名/文件名 PascalCase，工具函数 camelCase，常量 UPPER_SNAKE_CASE。
- **示例**:
  - ✅ `src/components/UserCard.tsx`, `const MAX_RETRY = 3;`
  - ❌ `src/components/user_card.js`, `const maxRetry = 3;`
- **例外**: 遵从微信小程序特定配置文件命名（如 `app.config.ts`）。

### 2.2 引用路径 (Should)

- **描述**: 优先使用 `@/` 别名引用 `src` 目录下资源，减少相对路径层级。
- **示例**:
  - ✅ `import { API } from '@/utils/request';`
  - ❌ `import { API } from '../../../utils/request';`
- **例外**: 同目录下的辅助文件引用可使用 `./`。

## 3. React 与 Taro 最佳实践

### 3.1 异步错误处理 (Must)

- **描述**: 所有异步操作（Taro.request, Promise 等）必须包含 `try-catch` 逻辑。
- **示例**:
  - ✅ `try { await Taro.request(...) } catch (e) { Taro.showToast(...) }`
  - ❌ `await Taro.request(...);` (未捕获异常会导致小程序白屏或逻辑中断)
- **例外**: 仅在全局有统一拦截器处理异常且无需局部反馈时。

### 3.2 消除魔法值 (Must)

- **描述**: 禁止在业务逻辑中直接使用硬编码的数字或字符串，必须抽离至 `constants.ts`。
- **示例**:
  - ✅ `if (status === GameStatus.PLAYING) { ... }`
  - ❌ `if (status === 1) { ... }`
- **例外**: 仅限 0, 1, -1 等具有明确数学语义的数字。

### 3.3 Taro 生命周期使用 (Should)

- **描述**: 页面初始化逻辑应放在 `useLoad` 中，而非 `useEffect`，以保证在小程序环境中正确获取参数。
- **示例**:
  - ✅ `useLoad((options) => { console.log(options.id) });`
  - ❌ `useEffect(() => { /* 无法直接获取 options */ }, []);`
- **例外**: 跨端 H5 兼容性特殊处理时。

## 4. 自动化与质量保障

### 4.1 规则分级说明

- **强制 (Must)**: 违规将阻断 CI 合并，对应 ESLint `error` 等级。
- **推荐 (Should)**: 建议遵循，对应 ESLint `warn` 等级，需在 CR 中说明理由。
- **可选 (May)**: 视场景选择，对应 ESLint `off` 或仅作参考。

### 4.2 校验工具

- 项目配套 `project_rules_validator.js` 脚本，集成于 `pre-commit` 钩子。
- CI 流程包含 `rules-compliance` 步骤，自动扫描变更文件。
