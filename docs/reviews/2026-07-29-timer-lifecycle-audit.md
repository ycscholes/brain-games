# Timer lifecycle audit - 2026-07-29

## Scope

Read-only audit. Command run: `rg -l --glob 'index.tsx' 'setTimeout\\(' src/pages | sort`.

Actual results (18): `bird-count`, `color-trap`, `digit-span`, `game-gauntlet`, `hidato`, `index`, `memory-challenge`, `mental-math`, `multiple-object-tracking`, `number-order`, `pet/components/PetSprite`, `pet`, `rock-paper-scissors`, `spatial-rotation`, `tents-camp`, `triad-match`, `twenty-four`, and `word-scramble`.

"Unmount cleanup" means an explicit React effect cleanup, or a source-provided page-hide lifecycle cleanup. It does not infer cancellation from a short delay.

## Findings

| Page | Timer mechanism and exact evidence | Cancellation trigger | Unmount cleanup | Action |
| --- | --- | --- | --- | --- |
| `bird-count` | `useTimerQueue` supplies `clear`/`schedule` at `src/pages/bird-count/index.tsx:223`; it schedules gameplay at `:412-418`, `:432-446`, `:549-551`, `:580-586`. Queue storage/clearing is `timerQueue.ts:1-20`; hook cleanup is `useTimerQueue.ts:13-17`. Loading-floor Promise uses `setTimeout` at `index.tsx:135-138`, awaited at `:466-475`. | Existing paths call `clearTimers()` at `:289-315`, `:404-450`, `:483-484`; preload continuation is run-id-gated at `:466-475`, with back invalidation at `:289-291`. | Yes for queued gameplay callbacks; the loading-floor Promise has no direct timer cleanup. | `migrate to queue` |
| `color-trap` | Retained `schedule` at `src/pages/color-trap/index.tsx:69-77`; answer/feedback use at `:203-225`. | `clearTimers()` at `:69-72`; called on finish/answer/new/start/back at `:131`, `:180`, `:214`, `:230`, `:254`. | Yes, `:95-99`. | `keep` |
| `digit-span` | Reveal handles retained at `src/pages/digit-span/index.tsx:53-59`, created at `:135-150`. | Clear before round `:124-125` and on finish `:88-90`. | Yes, `:81-86`. | `keep` |
| `game-gauntlet` | Ref-held delayed entry at `src/pages/game-gauntlet/index.tsx:42`, scheduled at `:70-79`. | `clearPendingNavigation()` at `:45-50`, before entry/reschedule at `:52-54`, `:70-71`. | Page-hide cleanup `:129-131`; no separate React unmount effect. | `keep` |
| `hidato` | Hint/wrong refs at `src/pages/hidato/index.tsx:67-68`, scheduled at `:212-220`, `:245-259`. | Both cleared at `:78-87`, replacement `:213-215`, `:253-255`, and back `:197-210`. | Yes, `:105-109`. | `keep` |
| `index` | Shared loading-floor Promise at `src/pages/index/index.tsx:63-67`, used `:92-106`; untracked deferred dashboard refresh `:168-173`; ref-held pet motion `:226-252`. | Listener removal/async state guard `:179-219`; pet motion clears `:226-252`. Deferred refresh has no handle or trigger. | Listener/pet motion yes (`:215-218`, `:246-252`); deferred refresh no. | `separate follow-up required` |
| `memory-challenge` | Retained `schedule` at `src/pages/memory-challenge/index.tsx:209-221`; feedback at `:468`, `:486`. | Clears interval/timeouts at `:209-216`, including game over `:371-374`. | Yes, cleanup returns `clearTimers` at `:234`. | `keep` |
| `mental-math` | Feedback handle at `src/pages/mental-math/index.tsx:323-339`. | `clearAllTimers()` clears interval and timeout at `:80-84`, used at `:265-267`, `:343-345`. | Yes, `:86-90`. | `keep` |
| `multiple-object-tracking` | Preview ref timeout `src/pages/multiple-object-tracking/index.tsx:359-362`; animation fallback uses timeout and paired clear at `:67-80`. | `clearRoundRuntime()` clears both at `:202-212`, before start at `:348-359`. | Yes, `:214-218`. | `keep` |
| `number-order` | Retained playback `schedule` at `src/pages/number-order/index.tsx:70-91`. | Clears all at `:70-73`, including finish `:115-122`. | Yes, `:109-113`. | `keep` |
| `pet/components/PetSprite` | Retry ref timeout at `src/pages/pet/components/PetSprite/index.tsx:40-64`. | Clear function `:44-49`, used on retry/key change/success at `:58-60`, `:69-79`, `:123-125`. | Yes, `:67`. | `keep` |
| `pet` | Feedback/feed/motion refs `src/pages/pet/index.tsx:113-175`; untracked deferred refresh `:187-192`. | Visual timers have clear functions `:117-136` and clear on replacement `:138-175`; deferred refresh has no handle or trigger. | Visual cleanup yes `:259-265`; deferred refresh no. | `separate follow-up required` |
| `rock-paper-scissors` | Bare feedback timers at `src/pages/rock-paper-scissors/index.tsx:216-231`. | No handle, clear, or callback invalidation. Interval cleanup at `:234-252` does not cover them. | No. | `separate follow-up required` |
| `spatial-rotation` | Retained `schedule` at `src/pages/spatial-rotation/index.tsx:93-101`; feedback/answer timers `:227-249`. | Clears at `:93-96`, used on finish/answer/new/start/back at `:155`, `:204`, `:238`, `:254`, `:278`. | Yes, `:119-123`. | `keep` |
| `tents-camp` | Retained feedback schedule at `src/pages/tents-camp/index.tsx:90-98`, `:261-267`. | Clears at `:90-93`, used at `:148`, `:188`, `:198`, `:240`, `:271`. | Yes, `:112-114`. | `keep` |
| `triad-match` | Retained schedule at `src/pages/triad-match/index.tsx:112-120`. | Clears at `:112-115`, including completion `:169-175`. | Yes, `:138-142`. | `keep` |
| `twenty-four` | Bare correct-answer advance timeout at `src/pages/twenty-four/index.tsx:233-245`; interval is separately ref-held/cleared at `:60-73`, `:95-97`, `:138-152`. | Advance timeout has no handle, clear, or invalidation; `clearTimer()` covers only the interval. | No for advance timeout. | `separate follow-up required` |
| `word-scramble` | Retained schedule at `src/pages/word-scramble/index.tsx:80-88`; hint/expiry/feedback/submit at `:196-206`, `:282-288`, `:311-313`. | Clears at `:80-83`, used at `:146`, `:186`, `:211`, `:236`, `:259`. | Yes, `:106-110`. | `keep` |

## Boundary and concerns

- No application source changed. Farm Count is the completed queue migration; its pre-existing cancellation call sites and delays are preserved.
- The four `separate follow-up required` rows are source-proven timeout-cancellation gaps: homepage deferred dashboard refresh, pet deferred refresh, rock-paper-scissors feedback, and twenty-four round advance. Each needs its own behavior baseline and design approval before repair.
- The homepage and Farm Count loading-floor Promise timers are included for completeness. Homepage removes consumers and guards component state; Farm Count gates preload continuation by run ID. This audit does not alter either loading flow.

## Validation and self-review

Ran after creating this document: `npm test`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

All commands completed successfully. No score, reward, record, or gauntlet expectations changed. Self-review confirmed only this document is staged, all 18 command results have mechanism/cancellation/unmount/action evidence, and no SDD ledger or application source changed.
