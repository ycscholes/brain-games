# CloudBase 音频备份

`v1/` 是运行时从 CloudBase `assets/audio/v1/` 读取的版本化音频源。它不会被小程序包直接导入。

- `focus-ambient.m4a`：OpenGameArt 的 CC0 背景音乐，详见 `docs/third-party-audio.md`。
- `tap.m4a`、`correct.m4a`、`wrong.m4a`、`complete.m4a`：由 `scripts/generate-audio-cues.mjs` 生成的原创提示音。

运行 `node scripts/generate-audio-cues.mjs` 生成原始 WAV，再用 macOS `afconvert -f m4af -d aac -b 96000` 编码为 AAC/M4A。M4A 同时兼容微信小程序的 iOS 与 Android，且本机无可用 MP3 编码器。运行 `npm run audio:check` 验证备份，运行 `npm run audio:upload` 上传。
