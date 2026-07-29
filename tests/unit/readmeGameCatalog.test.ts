import fs from "fs";
import path from "path";
import { ALL_GAME_ITEMS } from "../../src/config/gameCatalog";

test("README lists every public catalog game", () => {
  const readme = fs.readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
  ALL_GAME_ITEMS.forEach((game) => {
    expect(readme).toContain(`| ${game.title} |`);
    expect(readme).toContain(`| \`${game.url}\` |`);
  });
});
