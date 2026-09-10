# Repository Architecture

This document is the durable entry point for repository structure and cleanup
decisions. The active implementation remains under `src/`; historical plans
and generated promotion material are not runtime dependencies.

## Deferred repository metadata

Task 9 of the repository-architecture cleanup audited the following tracked
files. They are retained in the current commit because their external owners
or consumers have not been disproven:

| Candidate | Decision | Evidence and reason |
| --- | --- | --- |
| `.claude/settings.json` | Retain; deletion deferred | The host has an installed Claude Code CLI (`claude`), and its project setting sources can consume repository `.claude` settings. The file enables the `codex@openai-codex` plugin. No repository command references it, but that is not sufficient to prove external ownership is obsolete. |
| `skills-lock.json` | Retain; deletion deferred | It is a tracked skill-lock manifest for the external skill ecosystem. No repository command references it, but no external-tool audit proved that the manifest is unused. |
| `CLAUDE.MD` | Retain; deletion deferred | The host has an installed Claude Code CLI, which supports project instruction discovery. The file is therefore a possible external agent entry point even though its legacy instructions are not used by the repository runtime. |

These files are a **retain list**, not runtime imports. Deleting any of them
requires a separate external-entry audit that identifies the owner and proves
that the consumer has migrated or is retired. This cleanup deliberately does
not edit or delete them.

## Confirmed historical cleanup

The stale `.trae/documents` plan, the completed Traffic Escape task report,
and the broken duplicate skill-link farm under `.claude/skills/` were removed
after repository-wide reference and host-entry checks. The active
`.trae/rules/` validator and its tests remain because `lint:rules` depends on
them.
