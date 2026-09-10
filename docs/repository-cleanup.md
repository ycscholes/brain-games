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

## Task 12 historical-document audit (2026-09-10)

The audit index was generated outside the repository at
`/tmp/brain-games-history-index.txt` from HEAD `c7225c8`:

The approved rationale remains in
[`docs/superpowers/specs/2026-09-10-repository-architecture-cleanup-design.md`](superpowers/specs/2026-09-10-repository-architecture-cleanup-design.md),
and the execution plan remains in
[`docs/superpowers/plans/2026-09-10-repository-architecture-cleanup.md`](superpowers/plans/2026-09-10-repository-architecture-cleanup.md)
until final cleanup closeout.

```text
for f in docs/superpowers/plans/*.md docs/superpowers/specs/*.md docs/reviews/*.md; do
  printf '%s\t' "$f"; git log -1 --format='%h %s' -- "$f"
done > /tmp/brain-games-history-index.txt
```

Every candidate below was checked by content, not by directory or filename.
`source/tests/git` means that the current implementation and focused tests are
locatable and the implementation is present in git history. A retained row
means either that a live/deployment/device step is still open or that the
document preserves a product/interaction rationale not represented by the
durable architecture and module-contract docs.

### Deleted after evidence review

| File (last-touch commit) | Current source/test authority | Git/evidence and decision |
| --- | --- | --- |
| `docs/superpowers/plans/2026-06-13-twenty-four-scoring-range.md` (`89a2a53`) | `src/pages/twenty-four/{gameLogic.ts,index.tsx,README.md}`; `tests/unit/twentyFourGameLogic.test.ts`; `docs/points-economy.md` | `5d04005`, `fe14e47`, `c4e6fec`; scoring, 60-second mode, `1..10` range and shared reward rules are current and tested; procedural plan deleted. |
| `docs/superpowers/specs/2026-06-13-twenty-four-scoring-range-design.md` (`89a2a53`) | Same source/tests plus `docs/points-economy.md:23,76,247` | `5d04005`, `fe14e47`, `c4e6fec`; the original spec's `0..10` lower bound was superseded by `fe14e47`; the current authority is the `1..10` range, so the old `0` lower bound is not retained as a durable decision. Its remaining durable decision is fully extracted into the points document and page README; spec deleted. |
| `docs/superpowers/plans/2026-07-22-game-category-colors.md` (`ad8a68f`) | `src/config/gameCatalog.ts`, `src/pages/{index,all-games}/index.tsx`, `src/styles/game-list.scss`; `tests/unit/gameCatalog.test.ts` | `395eaae`, `103a26a`, `73a6aef`; all 16 implementation steps are checked and current source/tests locate the behavior; visual rationale remains in the retained design spec; plan deleted. |
| `docs/superpowers/plans/2026-07-22-game-removal-and-mode-categories.md` (`38a804d`) | `src/config/gameCatalog.ts`, `src/app.config.ts`, `src/utils/{trainingStorage,share}.ts`; `tests/unit/gameCatalog.test.ts`, `tests/unit/gameGauntlet.test.ts` | `6132703`, `21d4443`; retired IDs and category/reward references are removed and tested; category rationale remains in the retained design spec; plan deleted. |
| `docs/superpowers/plans/2026-07-27-loop-line.md` (`0c1a67d`) | `src/pages/loop-line/{gameLogic.ts,index.tsx}`, `src/config/gameCatalog.ts`, `src/utils/{trainingStorage,share}.ts`; `tests/unit/loopLineGameLogic.test.ts`, `tests/unit/gameCatalog.test.ts` | `71ead80`; current source, tests, points/candidate-pool entries and catalog/share registration prove completion; game rationale remains in the retained design spec; plan deleted. |
| `docs/superpowers/plans/2026-07-29-netwalk.md` (`6fecc89`) | `src/pages/netwalk/{gameLogic.ts,index.tsx}`, `src/config/gameCatalog.ts`; `tests/unit/netwalkGameLogic.test.ts`, `tests/unit/gameCatalog.test.ts` | `6fecc89`, `cb2aa08`; source/tests and points/candidate-pool entries prove the feature is implemented; game rationale remains in the retained design spec; plan deleted. |
| `docs/superpowers/plans/2026-07-31-traffic-netwalk-hidato-refinement.md` (`3ad87e9`) | `src/pages/{traffic-escape,netwalk,hidato}`, `scripts/generate-traffic-escape-hard-puzzles.ts`; `tests/unit/trafficEscapeGameLogic.test.ts`, `tests/unit/trafficEscapePuzzle*.test.ts` | `e0614c8`; current generated-puzzle/quality authorities and focused tests supersede the procedural checklist; refinement rationale remains in the retained design spec; plan deleted. |
| `docs/superpowers/plans/2026-08-01-home-game-groups.md` (`8965802`) | `src/config/gameCatalog.ts`, `src/pages/index/index.tsx`; `tests/unit/gameCatalog.test.ts` | `d896930`; `ALL_GAME_ITEMS`/`HOME_GAME_GROUPS` and ordering assertions are current; group rationale remains in the retained design spec; plan deleted. |
| `docs/superpowers/plans/2026-08-01-loop-line-entry-and-catalog.md` (`e39d035`) | `src/pages/loop-line/index.tsx`, `src/config/gameCatalog.ts`, `src/styles/game-list.scss`; `tests/unit/gameCatalog.test.ts` | `e39d035`; entry, ordering and shared-card behavior are in source/tests; rationale remains in the retained design spec; plan deleted. |
| `docs/superpowers/plans/2026-09-02-traffic-escape-navigation.md` (`c3f0549`) | `src/pages/traffic-escape/{index.tsx,play.tsx,result.tsx,run.ts}`, `src/utils/gameFlowSession.ts`; `tests/unit/gameFlowSession.test.ts`, `tests/unit/trafficEscapeRun.test.ts` (with `gameLogic.ts` limited to scoring) | `c3f0549`, `adb4021`, `16311aa`; interrupted-run/back behavior is current in the split flow pages and serialized-run/session authorities, with focused run/session regression coverage. `navigation.ts` was superseded by `16311aa feat: split traffic escape into flow pages`; the navigation rationale remains in retained specs; plan deleted. |
| `docs/superpowers/plans/2026-09-02-traffic-vehicle-centering.md` (`34cc123`) | `src/pages/traffic-escape/vehicleAtlas.ts`, `tests/unit/trafficVehicleAtlas.test.ts` | `34cc123`; centering constants and regression assertions are current; atlas rationale remains in retained specs; plan deleted. |
| `docs/superpowers/plans/2026-09-08-traffic-escape-official-account-article.md` (`287956e`) | Tracked `output/official-account/traffic-escape/article.md`; source facts in `src/pages/traffic-escape`, `docs/points-economy.md`, `src/config/gameCatalog.ts` | `1a5019a`, `434feb5`, `41bbc24`, `319e4b2`; article and later copy corrections are in git, while content boundaries remain in the retained design spec; procedural plan deleted. |

### Retained because unfinished or still rationale-bearing

| File (last-touch commit) | Evidence and reason to retain |
| --- | --- |
| `docs/superpowers/plans/2026-06-14-custom-ai-pet.md` (`4525ab4`) | `src/services/custom-pet`, `cloudfunctions/customPet*` and `tests/unit/customPet*.test.*` locate implemented behavior, but the plan still calls for environment deployment and real-device smoke evidence; retain until those are separately closed. |
| `docs/superpowers/plans/2026-07-11-audio-feedback.md` (`9cfedf0`) | `src/hooks/useAmbientMusic.ts`, audio services/assets and `tests/unit/audioFeedbackService.test.ts` locate implementation, while CloudBase upload/live playback evidence remains an external operation; retain the operational checklist. |
| `docs/superpowers/plans/2026-07-29-behavior-preserving-refactor.md` (`7eabb3b`) | `src/pages/bird-count/useTimerQueue.ts`, `tests/unit/timerQueue.test.ts` prove the completed queue extraction, but its audit records four source-proven cancellation gaps and an unperformed device flow; retain unresolved follow-up rationale. |
| `docs/superpowers/plans/2026-08-17-official-account-sticker.md` (`b62f40d`) | `src/utils/{stickerPublishing,stickerRewards}.ts`, sticker components and focused tests locate implementation, but the plan still requires qualified-AppID/mobile callback validation; retain. |
| `docs/superpowers/plans/2026-08-17-sticker-score-poster.md` (`7ffa71b`) | `src/components/stickers/StickerScorePoster.tsx`, `tests/unit/stickerScorePoster.test.ts` and `b983dbd` locate implementation, but the retained spec's iOS/Android-only export behavior still needs real-device evidence; retain. |
| `docs/superpowers/plans/2026-08-27-music-theory-adventure.md` (`759bf83`) | `src/pages/music-theory`, `tests/unit/musicTheoryGameLogic.test.ts`, `2f46d86` locate implementation, but its manual narrow-screen/touch/gauntlet acceptance remains unchecked; retain product scope and acceptance rationale. |
| `docs/superpowers/plans/2026-08-28-music-theory-child-first.md` (`b1fb3b4`) | `src/pages/music-theory/index.tsx`, `tests/unit/musicTheoryGameLogic.test.ts`, `2e18f55`, `8002371` locate the child-first changes; keep the interaction rationale and unclosed full validation checklist. |
| `docs/superpowers/plans/2026-08-31-traffic-escape-cartoon-vehicles.md` (`395f539`) | `src/pages/traffic-escape`, `asset-backups/cloudbase-images/games/traffic-escape`, `tests/unit/remoteAssets.test.ts`, `02747c3` locate implementation, but remote upload and Developer Tools/device checks are explicitly outstanding. |
| `docs/superpowers/plans/2026-09-01-traffic-escape-vehicle-atlas.md` (`552b5f8`) | `src/pages/traffic-escape/vehicleAtlas.ts`, atlas backup and `tests/unit/trafficVehicleAtlas.test.ts` locate implementation; the plan still requires remote-path/device visual confirmation not proved by local tests. |
| `docs/superpowers/plans/2026-09-01-traffic-escape-vehicle-forms.md` (`0bcb903`) | `src/pages/traffic-escape/gameLogic.ts`, `vehicleAtlas.ts`, `tests/unit/trafficEscapeGameLogic.test.ts`, `e6404a9` locate implementation, but upload and Developer Tools validation remain open. |
| `docs/superpowers/plans/2026-09-07-traffic-escape-certified-hard-puzzles.md` (`19a1043`) | `scripts/generate-traffic-escape-hard-puzzles.ts`, generated bank and certification tests locate the offline implementation (`1f9b7fd`, `edbe9ef`), but the required physical-device 120–180 second acceptance is not established by tests. |
| `docs/superpowers/plans/2026-09-07-traffic-escape-ten-vehicle-atlas.md` (`c4976f8`) | `src/pages/traffic-escape/vehicleAtlas.ts`, `config/remote-assets.json`, `tests/unit/trafficVehicleAtlas.test.ts`, `c4976f8`/`e384e02` locate implementation, while v6 upload and visual device checks remain external evidence. |
| `docs/superpowers/plans/2026-09-08-traffic-escape-structural-diversity.md` (`b78bae1`) | `src/pages/traffic-escape/{puzzleGenerator,puzzleQuality,hardPuzzles.generated.ts}`, generator tests and `b78bae1` locate code, but eight-board WeChat visual-variation acceptance remains open. |
| `docs/superpowers/specs/2026-06-14-custom-ai-pet-design.md` (`ed792b5`) | The custom-pet generation, quota, billing and recovery behavior remains product rationale beyond the architecture contract; retain with its unfinished operational plan. |
| `docs/superpowers/specs/2026-07-11-audio-feedback-design.md` (`9cfedf0`) | Audio source/license, lifecycle and platform fallback decisions remain rationale; implementation is in source/assets/tests, but remote playback is not a local-test claim. |
| `docs/superpowers/specs/2026-07-22-game-category-colors-design.md` (`7f6789b`) | Five-category color semantics and non-interference with card information hierarchy remain visual product rationale; source/tests prove implementation but architecture docs should not replace the design record. |
| `docs/superpowers/specs/2026-07-22-game-removal-and-mode-categories-design.md` (`fa0b404`) | Category meaning, retired-game compatibility and non-goals remain product rationale; current catalog/tests prove the implementation. |
| `docs/superpowers/specs/2026-07-29-behavior-preserving-refactor-design.md` (`37e8188`) | Conservative migration/non-goal decisions and the no-generic-framework boundary remain architecture rationale; timer follow-ups are still open. |
| `docs/superpowers/specs/2026-07-29-netwalk-design.md` (`569bbec`) | Netwalk puzzle semantics, visual language and input/accessibility rationale remain game-specific design. |
| `docs/superpowers/specs/2026-07-31-traffic-netwalk-hidato-refinement-design.md` (`4e7664e`) | Traffic/Netwalk/Hidato visual and puzzle-depth decisions remain feature rationale; current source/tests are the implementation authority. |
| `docs/superpowers/specs/2026-08-01-home-game-groups-design.md` (`28e5c5d`) | Home-group ordering, capacity and `isHot` compatibility rationale remain product decisions. |
| `docs/superpowers/specs/2026-08-01-loop-line-entry-and-catalog-design.md` (`b9fc670`) | Start-surface boundaries, catalog ordering and unchanged play/result behavior remain feature rationale. |
| `docs/superpowers/specs/2026-08-17-official-account-sticker-design.md` (`de4de92`) | Native callback, daily de-duplication and gauntlet exclusion are product/platform rationale; live AppID validation is not implied by tests. |
| `docs/superpowers/specs/2026-08-17-sticker-score-poster-design.md` (`7ffa71b`) | Canvas dimensions, text-only fallback and mobile-platform constraints remain specific interaction rationale. |
| `docs/superpowers/specs/2026-08-27-music-theory-adventure-design.md` (`759bf83`) | Child learning scope, chapter non-goals and C4–G5-only boundary remain game design rationale. |
| `docs/superpowers/specs/2026-08-28-music-theory-child-first-design.md` (`b1fb3b4`) | Short-copy, drag/click parity and reduced-motion interaction decisions remain rationale. |
| `docs/superpowers/specs/2026-08-31-traffic-escape-cartoon-vehicles-design.md` (`adc061a`) | Cartoon visual direction, fallback layering and touch-surface invariants remain asset/UI rationale. |
| `docs/superpowers/specs/2026-09-01-traffic-escape-vehicle-atlas-design.md` (`ba8fb5b`) | Transparent-atlas geometry and remote-versioning rationale remain specific asset decisions; the record also distinguishes local from unverified device evidence. |
| `docs/superpowers/specs/2026-09-01-traffic-escape-vehicle-forms-design.md` (`e6404a9`) | Length-specific appearance allocation and deterministic visual assignment remain game-specific rationale. |
| `docs/superpowers/specs/2026-09-02-game-play-navigation-design.md` (`71d2c2b`) | All-game return behavior, cleanup-before-return and gauntlet boundaries remain broader navigation rationale than the Traffic Escape example. |
| `docs/superpowers/specs/2026-09-02-traffic-escape-navigation-design.md` (`13a3861`) | Traffic Escape interruption/result navigation and gauntlet handoff remain feature rationale. |
| `docs/superpowers/specs/2026-09-07-traffic-escape-certified-hard-puzzles-design.md` (`b2f7822`) | Measurable hard-puzzle gates and the 120–180 second device target remain unresolved product rationale. |
| `docs/superpowers/specs/2026-09-07-traffic-escape-ten-vehicle-atlas-design.md` (`395ec69`) | Ten-slot atlas palette, v6 remote path and visual-only invariants remain asset rationale; device confirmation is still outstanding. |
| `docs/superpowers/specs/2026-09-08-game-page-flow-design.md` (`16311aa`) | The three-surface migration contract and gauntlet exception are durable rationale; current architecture docs cite the source/test authorities without deleting this migration record. |
| `docs/superpowers/specs/2026-09-08-traffic-escape-official-account-article-design.md` (`b1f4760`) | Evidence-backed copy boundaries and no-unverified-media policy remain editorial rationale for the tracked article. |
| `docs/superpowers/specs/2026-09-08-traffic-escape-structural-diversity-design.md` (`b78bae1`) | Template quotas, deterministic selection and offline-only metrics remain puzzle-generation rationale; visual acceptance remains open. |
| `docs/superpowers/specs/2026-09-10-repository-architecture-cleanup-design.md` (`d797671`) | Retained as the approved cleanup rationale; the brief explicitly requires it to remain. |
| `docs/superpowers/plans/2026-09-10-repository-architecture-cleanup.md` (`e389b35`) | Retained because later cleanup phases remain unfinished and the brief explicitly requires the execution plan to remain until final closeout. |
| `docs/reviews/2026-07-29-game-experience-ui-recommendations.md` (`60ad275`) | Proposal only; no implementation authority or completed migration proves the recommendations obsolete, so retain as product rationale. |
| `docs/reviews/2026-07-29-timer-lifecycle-audit.md` (`590bdfa`) | Retain because it records four source-proven cancellation gaps requiring separate design approval and follow-up. |

The two protected untracked `output/official-account/hidato/` and
`output/official-account/memory-challenge/` directories were not opened,
modified, staged or deleted. The cleanup design and execution plan remain
linked by this audit and are not deletion candidates in Task 12.
