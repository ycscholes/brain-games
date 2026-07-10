# 游戏音效、点击反馈与专注背景音乐设计

## 目标

为 Cici 脑部锻炼加入安静、明确且可关闭的声音反馈：首页和游戏准备页提供陪伴感背景音乐，答题和结算使用短提示音，主交互提供统一按压反馈。声音不能改变积分、计分、游戏状态或震动逻辑。

## 体验边界

- 背景音乐仅出现在首页、各训练游戏的 `start` 阶段以及闯关入口。进入答题阶段、离开页面、切后台或关闭音乐时立即停止。
- 主 CTA、游戏选项与游戏节点采用约 2% 缩放、阴影收束和 120ms 过渡的按压反馈；减少动效设置会关闭该过渡。
- `soundEnabled` 只控制轻触、正确、错误与完成音效；新增 `musicEnabled` 独立控制背景音乐。两项默认开启，且遵循系统静音。
- 资源无法解析、CloudBase 不可用或播放出错时静默降级；用户的点击、跳转、计分和奖励必须照常完成。

## 架构

`src/services/audio/audioFeedbackService.ts` 是唯一的播放入口，对页面提供 `playTap`、`playCorrect`、`playWrong`、`playComplete`、`startAmbient` 与 `stopAmbient`。服务复用一个背景音乐上下文和按需创建的短音效上下文，读取设置、解析 CloudBase URL，并对短音效进行节流。

`src/hooks/useAmbientMusic.ts` 将页面状态转换为背景音乐请求，并在页面隐藏或卸载时释放请求。页面只在可播放的准备状态传入 `true`；任一页面释放后服务停止不再被请求的音乐。

`src/config/remoteAssets.ts` 增加受限的音频 URL 解析接口，复用已有 CloudBase 临时链接缓存。音频备份位于 `asset-backups/cloudbase-audio/v1/`，线上路径为 `assets/audio/v1/`。

## 素材和版权

背景音乐使用 KiluaBoy 在 OpenGameArt 发布的 CC0 曲目《Sunset Walk / Ambient / Quiet / Sweet / Loop》。保留来源、许可证、下载日期和转换参数；从 OGG 转为 96kbps AAC/M4A，以兼容 iOS 与 Android。轻触、正确、错误和完成音效由项目制作，均为低动态、无语言内容的短提示音。

## 验收

- 用户可分别关闭音乐或音效，且已有设置能无损读入新字段。
- 音乐绝不覆盖游戏答题阶段；切后台、导航、关闭开关和播放失败均停止音乐。
- 连续作答不会产生失控叠加的音效；关闭音效时不创建播放。
- 单元测试覆盖设置迁移、语义路由、节流、生命周期和 URL/播放失败；通过测试、类型检查、lint 与微信构建。
