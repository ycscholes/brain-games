# 第三方音频台账

| 运行时文件 | 来源 | 作者 | 许可证 | 下载日期 | 转换 |
| --- | --- | --- | --- | --- | --- |
| `focus-ambient.m4a` | https://opengameart.org/content/sunset-walk-ambient-quiet-sweet-loop | KiluaBoy | CC0 | 2026-07-11 | `afconvert -f m4af -d aac -b 96000 SunsetWalk.wav focus-ambient.m4a` |

OpenGameArt 页面明确将该曲目标为 CC0。运行时文件 SHA-256：

- `focus-ambient.m4a`: `948351bdd4b670268512f4de6f234a89760075570f19e54b824b1f2f1b356787`
- `tap.m4a`: `6583716fd3a262a2517e30409c1fa4a0869f45c8c6893e5e4b4ff3c7424301cb`
- `correct.m4a`: `de4e89f571d6508810976d0901682547989b32222707c40acbfe32287aef4220`
- `wrong.m4a`: `6ca74243d4da47ed17166cfc0d3205ecd6bba533ba25f584bc8ab42a6a8c86b0`
- `complete.m4a`: `fb764c46d27e537e4e917df8e876c3369fb3a8f3eb4942b3caf4ae4b0fbf5b48`

其余四个提示音由本仓库 `scripts/generate-audio-cues.mjs` 合成，不含第三方样本。
