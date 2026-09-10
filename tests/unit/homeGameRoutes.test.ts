import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HOME_GAME_ITEMS } from "../../src/config/gameCatalog";

const root = resolve(process.cwd(), "src/pages");

describe("home game three-page route contract", () => {
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
      } else {
        expect(playSource).toContain("GameRouteBack");
        expect(playSource).toContain("useUnload");
      }
      expect(resultSource).toContain("<StickerShareButton");
      expect(runSource).toContain("settleGameRun");
      expect(runSource).toContain("abandonGameRun");
    }
  });

  test("keeps every home catalog entry pointed at its start page", () => {
    for (const game of HOME_GAME_ITEMS) {
      expect(game.url).toBe(`/pages/${game.id}/index`);
    }
  });
});
