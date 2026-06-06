# Farm Count Modes Design

## Goal

Merge "宠物速数" and "小剧场清点" into one farm-themed counting game entry. The merged game keeps two selectable modes:

- 宠物速数: quick selective counting from a moving group of pets.
- 农场进出: dynamic count tracking as pets enter and leave a farm pen.

The home page shows one game card for the merged experience. Existing routes remain usable so old navigation and shared links do not break.

## Product Scope

The unified entry is named "农场清点". It replaces the two separate home cards for "宠物速数" and "小剧场清点". The start screen presents a farm scene, a current-best score for the selected mode/settings, and a mode selector.

Pet skins used in both modes are chosen from the user's adopted pets first:

- Prefer alive adopted pets.
- Put the active pet first when it is alive.
- If the user has no alive adopted pets, fall back to all available pet skins.

This scope does not migrate historical training records. Existing records remain valid under their current game ids.

## Routes And Compatibility

`/pages/bird-count/index` becomes the canonical merged page. It supports an optional mode parameter:

- `mode=speed` opens 宠物速数.
- `mode=yard` opens 农场进出.

`/pages/head-count/index` remains as a compatibility page and redirects to `/pages/bird-count/index?mode=yard`. The route stays listed in app config.

The home page removes the separate "小剧场清点" and "宠物速数" cards and adds one "农场清点" card pointing to `/pages/bird-count/index`.

## Gameplay Behavior

宠物速数 reuses the existing `bird-count` question and scoring rules. The visual setting changes from a scrolling stage/sky-card to a farm lane. The target skin and decoys come from the prioritized pet skin pool.

农场进出 reuses the existing `head-count` event generation, speed settings, answer options, and scoring. The scene changes from theater room/person tokens to farm pen/pet tokens. Enter and leave events animate pets moving through farm gates. The answer remains the final number of pets in the pen.

Both modes keep eight questions per session. Difficulty labels, speed labels, combo bonuses, speed bonuses, best scores, awarded points, and result screens remain mode-specific.

## Data Flow

The merged page reads pet storage on load/show through existing pet storage helpers. It derives a prioritized `PetSkin[]` and passes it into both game generators.

The speed-count generator accepts an optional skin pool and uses it for target and decoy selection. The yard-count generator can remain numeric for correctness, while the page maps displayed static and moving pet tokens to skins from the same prioritized pool.

Training records remain separate:

- 宠物速数 records `gameId: "bird-count"`.
- 农场进出 records `gameId: "head-count"` with the existing mode string for difficulty and speed.

This preserves history, dashboard summaries, scoring caps, and pet point awards.

## Components And Files

Expected implementation files:

- `src/pages/bird-count/index.tsx`: merged mode state, shared start/result UI, speed mode flow, yard mode flow.
- `src/pages/bird-count/index.scss`: farm visual system for start, play, options, feedback, and result states.
- `src/pages/bird-count/gameLogic.ts`: optional pet skin pool support for speed-count questions.
- `src/pages/head-count/index.tsx`: compatibility redirect.
- `src/pages/index/index.tsx`: replace two cards with one merged card.
- `src/utils/trainingStorage.ts`: only update titles or ids if needed; avoid record migration.

## Error Handling

If pet storage cannot be read or has no alive pets, the game uses the full pet skin list. If an invalid mode query parameter is provided, the page defaults to 宠物速数. If redirect from the compatibility page fails, the page can render a simple loading state; no user data is changed.

Timers are cleared when switching modes, returning to start, finishing, or unmounting. Mode switches from the start screen reset in-progress state before starting another session.

## Testing And Acceptance

Verification commands:

- `npm run typecheck`
- `npm test -- --runInBand src/pages/bird-count src/pages/head-count` if matching tests exist, otherwise `npm test -- --runInBand` when practical.
- `npm run build:weapp`

Manual acceptance:

- Home page shows only one relevant card, "农场清点".
- The merged page starts in 宠物速数 by default.
- The user can switch to 农场进出 before starting.
- Old `/pages/head-count/index` opens the merged page in 农场进出 mode.
- Adopted alive pets appear before fallback pets in both modes.
- Both modes complete a session, award pet points, record training sessions, and update best scores independently.
