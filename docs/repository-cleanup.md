# Repository Cleanup Checklist

This document records the Task 9 cleanup audit. It is a durable cleanup
checklist, not the repository architecture entry point; the architecture guide
is owned by the later architecture-documentation task.

## Deferred external-entry candidates

The following tracked files remain because their external owners or consumers
have not been disproven:

| Candidate | Decision | Evidence and reason |
| --- | --- | --- |
| `.claude/settings.json` | Retain; deletion deferred | The host has an installed Claude Code CLI (`claude`), and its project setting sources can consume repository `.claude` settings. The file enables the `codex@openai-codex` plugin. No repository command references it, but that is not sufficient to prove external ownership is obsolete. |
| `skills-lock.json` | Retain; deletion deferred | It is a tracked skill-lock manifest for the external skill ecosystem. No repository command references it, but no external-tool audit proved that the manifest is unused. |
| `CLAUDE.MD` | Retain; deletion deferred | The host has an installed Claude Code CLI, which supports project instruction discovery. The file is therefore a possible external agent entry point even though its legacy instructions are not used by the repository runtime. |

These files are a **retain list**, not runtime imports. Deleting any of them
requires a separate external-entry audit that identifies the owner and proves
that the consumer has migrated or is retired. Task 9 deliberately does not edit
or delete them.

## Confirmed historical cleanup

The stale `.trae/documents` plan, the completed Traffic Escape task report,
and the broken duplicate skill-link farm under `.claude/skills/` were removed
after repository-wide reference and host-entry checks. The active
`.trae/rules/` validator and its tests remain because `lint:rules` depends on
them.
