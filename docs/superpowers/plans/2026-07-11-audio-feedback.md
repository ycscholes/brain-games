# 游戏音效与点击反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为脑力训练小程序提供可独立关闭的音效、准备页背景音乐和统一的主交互按压反馈。

**Architecture:** 以单例音频服务屏蔽 Taro `InnerAudioContext`、CloudBase 临时 URL 和设置读取。页面以语义事件和准备状态接入服务，不在游戏页复制音频实现。远程、版本化音频避免增加小程序包体，任意失败均静默降级。

**Tech Stack:** Taro 4、React 18、TypeScript、Jest、CloudBase Storage、MP3。

---

### Task 1: Settings and remote audio contracts

**Files:**
- Modify: `src/utils/trainingStorage.ts`
- Modify: `src/pages/settings/index.tsx`
- Modify: `src/config/remoteAssets.ts`
- Modify: `config/remote-assets.json`
- Test: `tests/unit/trainingStorage.test.ts`

- [ ] Add `musicEnabled: boolean` to `AppSettings`, make the default `true`, and continue merging stored settings over defaults so existing snapshots gain the field.
- [ ] Add a second settings switch labelled `背景音乐`; the existing `音效反馈` label remains the SFX toggle.
- [ ] Add versioned `assets/audio/v1` paths and an exported async resolver that returns an empty string when CloudBase cannot supply a URL.
- [ ] Test legacy settings parsing, separate persistence, and absent CloudBase configuration.

### Task 2: Audio service and lifecycle hook

**Files:**
- Create: `src/services/audio/audioFeedbackService.ts`
- Create: `src/hooks/useAmbientMusic.ts`
- Test: `tests/unit/audioFeedbackService.test.ts`

- [ ] Implement `playTap`, `playCorrect`, `playWrong`, `playComplete`, `startAmbient`, `stopAmbient`, and test reset helpers behind a narrow service API.
- [ ] Use one looping, quiet background context and lazily created short-sound contexts; only SFX contexts request `useWebAudioImplement`.
- [ ] Test disabled settings, failed URL resolution, error callbacks, 80ms tap throttling, and background lifecycle cleanup.
- [ ] Add a hook that starts music only when its boolean flag is true and stops it on page hide/unmount.

### Task 3: Versioned assets and audit trail

**Files:**
- Create: `asset-backups/cloudbase-audio/v1/*.mp3`
- Create: `asset-backups/cloudbase-audio/README.md`
- Create: `docs/third-party-audio.md`
- Create: `scripts/sync-cloudbase-audio.sh`
- Modify: `package.json`

- [ ] Add one 96kbps background loop and four original short MP3 cues, preserving the source and conversion metadata outside the app bundle.
- [ ] Add `audio:check` and `audio:upload`; upload files to `assets/audio/v1/`, requiring the same CloudBase environment variables as image upload.
- [ ] Record the CC0 source URL, license, file hash and conversion command in the license ledger.

### Task 4: Page feedback integration

**Files:**
- Create: `src/hooks/useAudioFeedback.ts`
- Modify: `src/app.scss`
- Modify: `src/pages/index/index.tsx`
- Modify: game and gauntlet page handlers under `src/pages/`

- [ ] Add a reusable wrapper that plays a tap before navigation/CTA handlers and a class helper for press feedback.
- [ ] Use the ambient hook in the home page, each game start state, and the gauntlet landing state; pass `false` while answering or navigating.
- [ ] Emit correct, wrong and complete sounds beside existing settled game outcomes without changing score or reward code.
- [ ] Apply the explicit press class to primary CTA, answer option and game-node components. Do not modify vibration behavior.

### Task 5: Verification and commit

**Files:**
- Modify: affected unit tests and documentation

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:weapp`, and `npm run audio:check`.
- [ ] Run `npm run audio:upload` only when CloudBase credentials are available; otherwise report the exact missing prerequisite.
- [ ] Stage only audio-feedback files and commit with a feature-scoped message.
