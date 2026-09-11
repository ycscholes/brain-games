import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HOME_GAME_ITEMS } from "../../src/config/gameCatalog";

const root = resolve(process.cwd(), "src/pages");

const MIGRATED_GAME_IDS = [
  "mental-math",
  "twenty-four",
  "digit-span",
  "rock-paper-scissors",
  "memory-challenge",
  "bird-count",
  "hidato",
  "tents-camp",
  "loop-line",
  "netwalk",
] as const;

const CONFIG_INHERITED_GAME_IDS = [
  "mental-math",
  "twenty-four",
  "digit-span",
  "rock-paper-scissors",
  "memory-challenge",
  "bird-count",
  "hidato",
  "netwalk",
] as const;

const ORIGINAL_RESULT_MARKERS: Record<(typeof MIGRATED_GAME_IDS)[number], string[]> = {
  "mental-math": ["MentalMathResultPanel", "onBackToStart", "onBackHome"],
  "twenty-four": ["tf-result", "tf-result-actions", "本局结束"],
  "digit-span": ["result-screen", "result-actions", "返回开始页"],
  "rock-paper-scissors": ["result-screen", "result-actions", "本局成绩"],
  "memory-challenge": ["MemoryChallengeResultPanel", "onBackToStart", "onBackHome"],
  "bird-count": ["FarmCountResult", "onBack", "onRestart"],
  hidato: ["finish-screen", "finish-actions", "返回难度"],
  "tents-camp": ["tents-result", "result-grid", "返回设置"],
  "loop-line": ["loop-line-finished", "loop-line-result-grid", "再来一局"],
  netwalk: ["netwalk-finish", "netwalk-finish-actions", "返回难度选择"],
};

const ORIGINAL_RESULT_ROOTS: Record<(typeof MIGRATED_GAME_IDS)[number], string> = {
  "mental-math": 'className="game-container',
  "twenty-four": '<View className="twenty-four-page">',
  "digit-span": '<View className="digit-span-page">',
  "rock-paper-scissors": '<View className="rps-game">',
  "memory-challenge": 'className="game-container',
  "bird-count": '<View className="farm-count-page">',
  hidato: '<View className="hidato-page">',
  "tents-camp": '<View className="tents-camp-page">',
  "loop-line": '<View className="loop-line-page">',
  netwalk: '<View className="netwalk-page">',
};

describe("home game three-page route contract", () => {
  test("removes the obsolete visible back component after migrating native back handling", () => {
    expect(existsSync(resolve(process.cwd(), "src/components/game-route/GameRouteBack.tsx"))).toBe(
      false,
    );
  });

  test("registers index, play, and result for every ordinary home game", () => {
    const pageConfig = readFileSync(resolve(process.cwd(), "src/app.config.ts"), "utf8");

    for (const game of HOME_GAME_ITEMS) {
      expect(existsSync(resolve(root, game.id, "index.tsx"))).toBe(true);
      expect(existsSync(resolve(root, game.id, "play.tsx"))).toBe(true);
      expect(existsSync(resolve(root, game.id, "result.tsx"))).toBe(true);
      expect(existsSync(resolve(root, game.id, "run.ts"))).toBe(true);
      expect(pageConfig).toContain(`pages/${game.id}/index`);
      expect(pageConfig).toContain(`pages/${game.id}/play`);
      expect(pageConfig).toContain(`pages/${game.id}/result`);

      const playSource = readFileSync(resolve(root, game.id, "play.tsx"), "utf8");
      const resultSource = readFileSync(resolve(root, game.id, "result.tsx"), "utf8");
      const runSource = readFileSync(resolve(root, game.id, "run.ts"), "utf8");
      if (game.id === "traffic-escape") {
        expect(playSource).toContain("abandonTrafficEscapeRun");
        expect(playSource).toContain('redirectTo({ url: "/pages/traffic-escape/index" })');
      } else if (MIGRATED_GAME_IDS.includes(game.id as (typeof MIGRATED_GAME_IDS)[number])) {
        expect(playSource).not.toContain("GameRouteBack");
        expect(playSource).toContain("useUnload");
        expect(playSource).toContain('routeRun.status !== "active"');
        expect(playSource).toContain(`redirectTo({ url: "/pages/${game.id}/index" })`);
      }
      const resultOwnsSticker = resultSource.includes("<StickerShareButton");
      const resultDelegatesToPanel =
        resultSource.includes("ResultPanel") || resultSource.includes("FarmCountResult");
      expect(resultOwnsSticker || resultDelegatesToPanel).toBe(true);
      expect(resultSource).toContain("replaceWithGamePlay");
      expect(resultSource).toContain("create");
      expect(runSource).toContain("settleGameRun");
      expect(runSource).toContain("abandonGameRun");

      if (MIGRATED_GAME_IDS.includes(game.id as (typeof MIGRATED_GAME_IDS)[number])) {
        for (const marker of ORIGINAL_RESULT_MARKERS[
          game.id as (typeof MIGRATED_GAME_IDS)[number]
        ]) {
          expect(resultSource).toContain(marker);
        }
        expect(resultSource).toContain(
          ORIGINAL_RESULT_ROOTS[game.id as (typeof MIGRATED_GAME_IDS)[number]],
        );
        if (game.id === "mental-math") {
          expect(resultSource).toContain("mental-math-result-page");
          expect(resultSource).toContain("isGauntlet={false}");
          const styleSource = readFileSync(resolve(root, game.id, "index.scss"), "utf8");
          expect(styleSource).toContain(".mental-math-result-page .result-actions");
          expect(styleSource).toContain(".mental-math-result-page .primary-button");
          expect(styleSource).toContain(".mental-math-result-page .result-score");
        } else {
          expect(resultSource).toContain("isGauntletPreset");
        }
      }
    }
  });

  test("keeps the original loop-line result surface without adding a new visual return control", () => {
    const resultSource = readFileSync(resolve(root, "loop-line", "result.tsx"), "utf8");
    expect(resultSource).not.toContain("返回开始页");
  });

  test("inherits the original page config on result routes only where the index had one", () => {
    for (const gameId of CONFIG_INHERITED_GAME_IDS) {
      const indexConfigPath = resolve(root, gameId, "index.config.ts");
      const resultConfigPath = resolve(root, gameId, "result.config.ts");
      expect(existsSync(resultConfigPath)).toBe(true);
      expect(readFileSync(resultConfigPath, "utf8")).toBe(readFileSync(indexConfigPath, "utf8"));
    }

    expect(existsSync(resolve(root, "tents-camp", "result.config.ts"))).toBe(false);
    expect(existsSync(resolve(root, "loop-line", "result.config.ts"))).toBe(false);
  });

  test("keeps every home catalog entry pointed at its start page", () => {
    for (const game of HOME_GAME_ITEMS) {
      expect(game.url).toBe(`/pages/${game.id}/index`);
    }
  });
});
