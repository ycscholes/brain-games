# 车阵突围无底色车辆精灵图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一张裁净透明边缘的车辆图集替换棋盘内的彩色 CSS 车辆底板，并保持两格、三格车辆在横竖朝向下的正确占格比例。

**Architecture:** 将六张已有 PNG 裁切、等比缩放为固定两行图集：上行的三个 `2:1` 图块与下行的三个 `3:1` 图块。页面只解析一个 CloudBase URL，在可裁切视窗中复用该资源；竖车先使用同一横向视窗再旋转，绝不压缩图像。

**Tech Stack:** Taro React、TypeScript、SCSS、Jest、CloudBase Storage、Python Pillow（只裁切和合成现有图片）。

---

## File structure

- Create: `scripts/create-traffic-vehicle-atlas.py` — 可重复的透明边缘裁切和图集生成器。
- Create: `src/pages/traffic-escape/vehicleAtlas.ts` — 车型到图集行列的纯映射。
- Create: `tests/unit/trafficVehicleAtlas.test.ts` — 映射与长度一致性的单元测试。
- Modify: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png` — 输出的单张透明图集。
- Modify: `src/config/remoteAssets.ts` and `tests/unit/remoteAssets.test.ts` — 只解析图集 URL。
- Modify: `src/pages/traffic-escape/index.tsx` and `src/pages/traffic-escape/index.scss` — 单图裁切、横竖比例与无底色样式。
- Modify: `docs/superpowers/specs/2026-09-01-traffic-escape-vehicle-atlas-design.md` — 写入实际验证证据。

### Task 1: Define and test the atlas slot contract

**Files:**
- Create: `src/pages/traffic-escape/vehicleAtlas.ts`
- Create: `tests/unit/trafficVehicleAtlas.test.ts`

- [ ] **Step 1: Write the failing mapping test**

```ts
import { getTrafficVehicleAtlasSlot } from "../../src/pages/traffic-escape/vehicleAtlas";

describe("getTrafficVehicleAtlasSlot", () => {
  test.each([
    ["sport", 2, { column: 0, row: "two-cell" }],
    ["compact-van", 2, { column: 1, row: "two-cell" }],
    ["city-taxi", 2, { column: 2, row: "two-cell" }],
    ["city-bus", 3, { column: 0, row: "three-cell" }],
    ["box-truck", 3, { column: 1, row: "three-cell" }],
    ["stretch-sedan", 3, { column: 2, row: "three-cell" }],
  ] as const)("maps %s", (appearance, length, expected) => {
    expect(getTrafficVehicleAtlasSlot(appearance, length)).toEqual(expected);
  });
  test("rejects an appearance with the wrong length", () => {
    expect(() => getTrafficVehicleAtlasSlot("city-bus", 2)).toThrow("does not belong to a 2-cell vehicle");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx jest tests/unit/trafficVehicleAtlas.test.ts --runInBand`

Expected: FAIL because `vehicleAtlas.ts` does not exist.

- [ ] **Step 3: Implement the minimal typed mapping**

```ts
import { TRAFFIC_VEHICLE_APPEARANCES, type TrafficVehicleAppearance } from "./gameLogic";

export type TrafficVehicleAtlasSlot = { column: 0 | 1 | 2; row: "two-cell" | "three-cell" };

export function getTrafficVehicleAtlasSlot(appearance: TrafficVehicleAppearance, length: 2 | 3): TrafficVehicleAtlasSlot {
  const column = TRAFFIC_VEHICLE_APPEARANCES[length].indexOf(appearance as never);
  if (column < 0) throw new Error(`${appearance} does not belong to a ${length}-cell vehicle`);
  return { column: column as 0 | 1 | 2, row: length === 2 ? "two-cell" : "three-cell" };
}
```

- [ ] **Step 4: Prove the test passes and commit**

Run: `npx jest tests/unit/trafficVehicleAtlas.test.ts --runInBand`

Expected: PASS.

```bash
git add src/pages/traffic-escape/vehicleAtlas.ts tests/unit/trafficVehicleAtlas.test.ts
git commit -m "feat: map traffic vehicles to atlas slots"
```

### Task 2: Produce a tightly cropped transparent atlas from existing vehicles

**Files:**
- Create: `scripts/create-traffic-vehicle-atlas.py`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png`

- [ ] **Step 1: Add the reproducible atlas builder**

```python
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "asset-backups/cloudbase-images/games/traffic-escape"
OUTPUT = ASSET_DIR / "vehicle-atlas.png"
TILE_WIDTH, TWO_CELL_HEIGHT, THREE_CELL_HEIGHT, PADDING = 1024, 512, 341, 20
ROWS = (
    (("vehicle-target.png", "vehicle-compact-van.png", "vehicle-city-taxi.png"), TWO_CELL_HEIGHT),
    (("vehicle-city-bus.png", "vehicle-box-truck.png", "vehicle-stretch-sedan.png"), THREE_CELL_HEIGHT),
)

def trimmed(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None: raise ValueError(f"{path} has no visible pixels")
    return image.crop(bounds)

def main() -> None:
    atlas = Image.new("RGBA", (TILE_WIDTH * 3, TWO_CELL_HEIGHT + THREE_CELL_HEIGHT), (0, 0, 0, 0))
    top = 0
    for filenames, height in ROWS:
        for column, filename in enumerate(filenames):
            image = trimmed(ASSET_DIR / filename)
            image.thumbnail((TILE_WIDTH - 2 * PADDING, height - 2 * PADDING), Image.Resampling.LANCZOS)
            atlas.alpha_composite(image, (column * TILE_WIDTH + (TILE_WIDTH - image.width) // 2, top + (height - image.height) // 2))
        top += height
    atlas.save(OUTPUT, optimize=True)

if __name__ == "__main__": main()
```

- [ ] **Step 2: Generate and inspect the artifact**

Run:

```bash
python3 scripts/create-traffic-vehicle-atlas.py
sips -g pixelWidth -g pixelHeight -g hasAlpha asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png
```

Expected: a transparent `3072 × 853` PNG. Open it in Codex and confirm six entire vehicle bodies are visible, with only 20 px safety padding around each tile.

- [ ] **Step 3: Verify every tile has bounded visible pixels**

Run:

```bash
python3 - <<'PY'
from PIL import Image
image = Image.open("asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png").convert("RGBA")
for row, y, height in (("two", 0, 512), ("three", 512, 341)):
    for column in range(3):
        alpha = image.crop((column * 1024, y, (column + 1) * 1024, y + height)).getchannel("A")
        assert alpha.getbbox(), f"{row}-{column} is empty"
print("six non-empty atlas tiles")
PY
```

Expected: `six non-empty atlas tiles`; do not commit an atlas that clips a tire, roof, or shadow.

- [ ] **Step 4: Commit the atlas**

```bash
git add scripts/create-traffic-vehicle-atlas.py asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png
git commit -m "feat: add traffic vehicle atlas"
```

### Task 3: Resolve exactly one CloudBase atlas URL

**Files:**
- Modify: `src/config/remoteAssets.ts:1-25,344-350`
- Modify: `tests/unit/remoteAssets.test.ts:26-112`

- [ ] **Step 1: Replace the old appearance-specific tests with this failing test**

```ts
const TRAFFIC_ATLAS_FILE_ID = "cloud://test-env.test-bucket/assets/games/traffic-escape/vehicle-atlas.png";

test("resolves the traffic vehicle atlas with one CloudBase request", async () => {
  mockGetTempFileURL.mockResolvedValue({ fileList: [{ tempFileURL: "https://fresh.example/vehicle-atlas.png" }] });
  mockEnsureCloudReady.mockResolvedValue({ getTempFileURL: mockGetTempFileURL });
  const { resolveTrafficVehicleAtlasUrl } = await import("../../src/config/remoteAssets");
  await expect(resolveTrafficVehicleAtlasUrl()).resolves.toBe("https://fresh.example/vehicle-atlas.png");
  expect(mockGetTempFileURL).toHaveBeenCalledTimes(1);
  expect(mockGetTempFileURL).toHaveBeenCalledWith({ fileList: [{ fileID: TRAFFIC_ATLAS_FILE_ID, maxAge: TEMP_URL_MAX_AGE_SECONDS }] });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/unit/remoteAssets.test.ts --runInBand -t "traffic vehicle atlas"`

Expected: FAIL because `resolveTrafficVehicleAtlasUrl` is not exported.

- [ ] **Step 3: Replace the six paths and resolver**

```ts
const TRAFFIC_VEHICLE_ATLAS_PATH = "assets/games/traffic-escape/vehicle-atlas.png";

export async function resolveTrafficVehicleAtlasUrl(options?: ResolveCloudFileUrlOptions): Promise<string> {
  return resolveCloudFileUrl(TRAFFIC_VEHICLE_ATLAS_PATH, options);
}
```

Remove `TrafficVehicleAppearance`, `TRAFFIC_VEHICLE_PATHS`, and `resolveTrafficVehicleUrl` from this module.

- [ ] **Step 4: Run focused tests and commit**

Run: `npx jest tests/unit/remoteAssets.test.ts tests/unit/trafficVehicleAtlas.test.ts --runInBand`

Expected: PASS.

```bash
git add src/config/remoteAssets.ts tests/unit/remoteAssets.test.ts
git commit -m "refactor: resolve one traffic vehicle atlas"
```

### Task 4: Render complete cropped vehicles with no CSS vehicle background

**Files:**
- Modify: `src/pages/traffic-escape/index.tsx:66,82-97,217-251`
- Modify: `src/pages/traffic-escape/index.scss:328-366`

- [ ] **Step 1: Change the page state to a single URL**

```ts
const [vehicleAtlasUrl, setVehicleAtlasUrl] = useState("");
useEffect(() => {
  let active = true;
  void resolveTrafficVehicleAtlasUrl().then((url) => { if (active) setVehicleAtlasUrl(url); }).catch(() => {
    if (active) setVehicleAtlasUrl("");
  });
  return () => { active = false; };
}, []);
```

Import `getTrafficVehicleAtlasSlot` and `resolveTrafficVehicleAtlasUrl`; remove the six-appearance `Promise.all` preload.

- [ ] **Step 2: Render a clipped reuse of the single image**

```tsx
const atlasSlot = getTrafficVehicleAtlasSlot(vehicle.appearance ?? "sport", vehicle.length);
{vehicleAtlasUrl ? (
  <View className={`traffic-vehicle-atlas-viewport traffic-vehicle-atlas-${atlasSlot.row} traffic-vehicle-atlas-column-${atlasSlot.column} ${isHorizontal ? "traffic-vehicle-atlas-horizontal" : "traffic-vehicle-atlas-vertical"}`}>
    <Image className="traffic-vehicle-atlas-image" src={vehicleAtlasUrl} mode="widthFix" onError={() => setVehicleAtlasUrl("")} />
  </View>
) : null}
```

Keep grid spans, event handler, target marker, selected and hinted state unchanged. Use `traffic-vehicle-has-atlas` only for atlas-loaded state.

- [ ] **Step 3: Apply this geometry and remove visual car-body CSS**

```scss
.traffic-vehicle { position: relative; z-index: 2; margin: 3px; overflow: visible; background: transparent; border: 0; border-radius: 0; box-shadow: none; }
.traffic-vehicle-atlas-viewport { position: absolute; top: 0; left: 0; overflow: hidden; pointer-events: none; }
.traffic-vehicle-atlas-horizontal { width: 100%; height: 100%; }
.traffic-vehicle-atlas-vertical { top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(90deg); }
.traffic-vehicle-atlas-vertical.traffic-vehicle-atlas-two-cell { width: 200%; height: 50%; }
.traffic-vehicle-atlas-vertical.traffic-vehicle-atlas-three-cell { width: 300%; height: 33.3333%; }
.traffic-vehicle-atlas-image { position: absolute; width: 300%; max-width: none; }
.traffic-vehicle-atlas-two-cell .traffic-vehicle-atlas-image { top: 0; }
.traffic-vehicle-atlas-three-cell .traffic-vehicle-atlas-image { top: -150%; }
.traffic-vehicle-atlas-column-0 .traffic-vehicle-atlas-image { left: 0; }
.traffic-vehicle-atlas-column-1 .traffic-vehicle-atlas-image { left: -100%; }
.traffic-vehicle-atlas-column-2 .traffic-vehicle-atlas-image { left: -200%; }
.traffic-vehicle-window { display: none; }
.traffic-vehicle-mark { z-index: 3; }
```

Delete all six `.traffic-vehicle-{color}` gradient declarations and the old image rules. Keep selected and hint feedback, but make the pulse use `filter: drop-shadow(...)` or an outline only, never an inset car-body shadow.

- [ ] **Step 4: Run verification and inspect the built UI**

Run:

```bash
npx jest tests/unit/trafficVehicleAtlas.test.ts tests/unit/remoteAssets.test.ts tests/unit/trafficEscapeGameLogic.test.ts --runInBand
npm run typecheck
npm run build:weapp
```

Expected: PASS. In WeChat Developer Tools, start normal and hard games: no colored rectangular car backgrounds; all six bodies complete; vertical two-cell cars occupy `1:2`; vertical three-cell cars occupy `1:3`; target mark, selection, hint pulse and full touch areas remain visible.

- [ ] **Step 5: Commit the renderer**

```bash
git add src/pages/traffic-escape/index.tsx src/pages/traffic-escape/index.scss
git commit -m "feat: render traffic vehicles from atlas"
```

### Task 5: Validate, upload, and record evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-09-01-traffic-escape-vehicle-atlas-design.md`

- [ ] **Step 1: Run all repository gates**

```bash
npm run assets:check
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build:weapp
npm run secrets:check
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Upload without exposing credentials**

```bash
set -a
source .env.production.local
set +a
npm run assets:upload
```

Expected: output includes `assets/games/traffic-escape/vehicle-atlas.png`.

- [ ] **Step 3: Confirm the uploaded atlas in Developer Tools and document evidence**

Repeat Task 4’s visual checks with the remote URL. Append the actual atlas dimensions, exact successful commands, CloudBase path and visible result to the spec; never claim a deploy or visual check that did not complete.

- [ ] **Step 4: Commit the evidence**

```bash
git add docs/superpowers/specs/2026-09-01-traffic-escape-vehicle-atlas-design.md
git commit -m "docs: verify traffic vehicle atlas"
```

