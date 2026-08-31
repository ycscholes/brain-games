# 车阵突围卡通车辆素材 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Traffic Escape's flat-color board vehicles with loading-safe, CloudBase-hosted cartoon car images without changing game rules or rewards.

**Architecture:** Generate six RGBA PNG vehicle cutouts using the selected rounded racing-car direction. `remoteAssets.ts` owns color-to-CloudBase path resolution and cache reuse; the Traffic Escape page resolves all six URLs on entry and displays a Taro `Image` over the existing CSS vehicle shell. The CSS shell stays visible whenever a remote image is absent or fails to load.

**Tech Stack:** React, Taro, TypeScript, Sass, Jest, CloudBase Storage, built-in Codex image generation.

---

### Task 1: Add a tested Traffic Escape remote-asset contract

**Files:**
- Modify: `src/config/remoteAssets.ts`
- Modify: `tests/unit/remoteAssets.test.ts`

- [ ] **Step 1: Write the failing resolver tests**

Add to `tests/unit/remoteAssets.test.ts` next to the other remote URL tests:

```ts
const TRAFFIC_TARGET_FILE_ID = "cloud://test-env.test-bucket/assets/games/traffic-escape/vehicle-target.png";

test("resolves every traffic vehicle color to its CloudBase image", async () => {
  mockGetTempFileURL.mockResolvedValue({
    fileList: [{ tempFileURL: "https://fresh.example/vehicle-target.png" }],
  });
  mockEnsureCloudReady.mockResolvedValue({ getTempFileURL: mockGetTempFileURL });
  const { resolveTrafficVehicleUrl } = await import("../../src/config/remoteAssets");

  await expect(resolveTrafficVehicleUrl("target")).resolves.toBe("https://fresh.example/vehicle-target.png");
  expect(mockGetTempFileURL).toHaveBeenCalledWith({
    fileList: [{ fileID: TRAFFIC_TARGET_FILE_ID, maxAge: TEMP_URL_MAX_AGE_SECONDS }],
  });
});

test("returns an empty URL for an unknown traffic vehicle color", async () => {
  const { resolveTrafficVehicleUrl } = await import("../../src/config/remoteAssets");
  await expect(resolveTrafficVehicleUrl("unknown")).resolves.toBe("");
});
```

- [ ] **Step 2: Run the focused test and confirm the expected red state**

Run: `npm test -- --runTestsByPath tests/unit/remoteAssets.test.ts`

Expected: TypeScript/Jest import failure because `resolveTrafficVehicleUrl` is not exported yet.

- [ ] **Step 3: Add the color union, stable path map, and resolver**

Add after `AUDIO_ASSET_PATHS` in `src/config/remoteAssets.ts`:

```ts
export const TRAFFIC_VEHICLE_COLORS = ["target", "amber", "cyan", "violet", "lime", "coral"] as const;
export type TrafficVehicleColor = (typeof TRAFFIC_VEHICLE_COLORS)[number];

const TRAFFIC_VEHICLE_PATHS: Record<TrafficVehicleColor, string> = {
  target: "assets/games/traffic-escape/vehicle-target.png",
  amber: "assets/games/traffic-escape/vehicle-amber.png",
  cyan: "assets/games/traffic-escape/vehicle-cyan.png",
  violet: "assets/games/traffic-escape/vehicle-violet.png",
  lime: "assets/games/traffic-escape/vehicle-lime.png",
  coral: "assets/games/traffic-escape/vehicle-coral.png",
};
```

Add after `resolveAudioAssetUrl`:

```ts
export async function resolveTrafficVehicleUrl(
  color: string,
  options?: ResolveCloudFileUrlOptions,
): Promise<string> {
  const path = TRAFFIC_VEHICLE_PATHS[color as TrafficVehicleColor];
  return path ? resolveCloudFileUrl(path, options) : "";
}
```

- [ ] **Step 4: Run the focused test and confirm green**

Run: `npm test -- --runTestsByPath tests/unit/remoteAssets.test.ts`

Expected: PASS, including the new Traffic Escape path and unknown-color coverage.

- [ ] **Step 5: Commit the tested resolver seam**

```bash
git add src/config/remoteAssets.ts tests/unit/remoteAssets.test.ts
git commit -m "feat: resolve traffic vehicle assets"
```

### Task 2: Generate, remove chroma key from, and validate six vehicle images

**Files:**
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-target.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-amber.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-cyan.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-violet.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-lime.png`
- Create: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-coral.png`

- [ ] **Step 1: Generate one consistent 1:1 vehicle cutout for each color using built-in `image_gen`**

Issue one built-in `image_gen` call per color. Set the requested color and filename exactly as follows: `target` = red, `amber` = golden yellow, `cyan` = sky blue, `violet` = violet, `lime` = lime green, and `coral` = coral orange. Add `a bright white racing stripe and a tiny gold star on the door` only to the red target-car prompt.

```text
Use case: stylized-concept
Asset type: WeChat mini-program puzzle-game vehicle image
Primary request: one compact, side-view cartoon racing car in the assigned color, facing right; toy-like rounded body, obvious windshield, two large dark wheels, bright headlight at the front, and a clean silhouette that remains recognizable at 56 px.
Style/medium: premium colorful 2D game illustration, smooth rounded forms, crisp edges, no text.
Composition/framing: centered horizontal vehicle, full body visible, 12 percent safe padding on every side.
Background: perfectly flat solid #ff00ff chroma-key background; no shadow, floor, gradient, reflection, or texture.
Constraints: no logo, no watermark, no labels, no border, no frame, no magenta in the vehicle.
```

- [ ] **Step 2: Copy each selected built-in output to `tmp/imagegen/` and remove the chroma-key background**

Copy the selected tool outputs to `tmp/imagegen/vehicle-target-source.png`, `tmp/imagegen/vehicle-amber-source.png`, `tmp/imagegen/vehicle-cyan-source.png`, `tmp/imagegen/vehicle-violet-source.png`, `tmp/imagegen/vehicle-lime-source.png`, and `tmp/imagegen/vehicle-coral-source.png`, then run:

```bash
for color in target amber cyan violet lime coral; do
  python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
    --input "tmp/imagegen/vehicle-${color}-source.png" \
    --out "tmp/imagegen/vehicle-${color}.png" \
    --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
done
```

- [ ] **Step 3: Validate alpha and small-size readability before copying final files**

Run this read-only validation for every final PNG:

```bash
for color in target amber cyan violet lime coral; do
  python -c 'from pathlib import Path; from PIL import Image; import sys; p=Path(sys.argv[1]); im=Image.open(p).convert("RGBA"); a=im.getchannel("A"); assert a.getpixel((0,0)) == 0 and a.getpixel((im.width-1,0)) == 0 and a.getpixel((0,im.height-1)) == 0 and a.getpixel((im.width-1,im.height-1)) == 0; assert a.getbbox(); print(p, im.size, a.getbbox())' "tmp/imagegen/vehicle-${color}.png"
done
```

Inspect the six images with `view_image` at original resolution. Reject and regenerate any image with clipped wheels, unreadable front direction, visible background contamination, text, or a different illustration style.

- [ ] **Step 4: Copy validated images to the CloudBase backup directory**

```bash
mkdir -p asset-backups/cloudbase-images/games/traffic-escape
cp tmp/imagegen/vehicle-*.png asset-backups/cloudbase-images/games/traffic-escape/
```

- [ ] **Step 5: Check the new backup assets**

Run:

```bash
npm run assets:check
find asset-backups/cloudbase-images/games/traffic-escape -maxdepth 1 -type f -name 'vehicle-*.png' | sort
```

Expected: `assets:check` passes and the second command lists exactly the six planned `vehicle-*.png` files.

### Task 3: Render the remote vehicles over the resilient CSS shell

**Files:**
- Modify: `src/pages/traffic-escape/index.tsx`
- Modify: `src/pages/traffic-escape/index.scss`

- [ ] **Step 1: Add a URL cache to the page state and resolve assets when the page is shown**

Extend the Taro import and add state:

```ts
import { Image, Text, View } from "@tarojs/components";
import { resolveTrafficVehicleUrl, type TrafficVehicleColor } from "../../config/remoteAssets";

const [vehicleImageUrls, setVehicleImageUrls] = useState<Partial<Record<TrafficVehicleColor, string>>>({});
```

Add this effect after the existing `refreshBest` effect:

```ts
useEffect(() => {
  let active = true;
  void Promise.all(TRAFFIC_VEHICLE_COLORS.map(async (color) => [color, await resolveTrafficVehicleUrl(color)] as const))
    .then((entries) => {
      if (active) setVehicleImageUrls(Object.fromEntries(entries.filter(([, url]) => Boolean(url))));
    });
  return () => { active = false; };
}, []);
```

Also import `TRAFFIC_VEHICLE_COLORS` from the same module.

- [ ] **Step 2: Replace only the decorative vehicle children in `renderVehicle`**

Immediately after `const isHorizontal = vehicle.orientation === "horizontal";`, add:

```tsx
const vehicleImageUrl = vehicleImageUrls[vehicle.color as TrafficVehicleColor];
```

Then, inside the existing vehicle `View` before the two `.traffic-vehicle-window` elements, add:

```tsx

{vehicleImageUrl ? (
  <Image
    className={`traffic-vehicle-image ${isHorizontal ? "traffic-vehicle-image-horizontal" : "traffic-vehicle-image-vertical"}`}
    src={vehicleImageUrl}
    mode="aspectFit"
    onError={() => setVehicleImageUrls((current) => ({ ...current, [vehicle.color]: "" }))}
  />
) : null}
```

Keep the existing windows and target mark in the JSX as the no-network fallback. Do not change grid placement, the click handler, reducer calls, score calculations, or feedback copy.

Append `${vehicleImageUrl ? "traffic-vehicle-has-image" : ""}` to that same container's existing `className` string so the CSS can hide only fallback decorations after image resolution.

- [ ] **Step 3: Add scoped overlay styles without removing fallback rules**

Add to `src/pages/traffic-escape/index.scss`:

```scss
.traffic-vehicle-image {
  position: absolute;
  z-index: 1;
  width: calc(100% - 4px);
  height: calc(100% - 4px);
  pointer-events: none;
}

.traffic-vehicle-image-horizontal { transform: rotate(0deg); }
.traffic-vehicle-image-vertical { transform: rotate(90deg); }
.traffic-vehicle-has-image .traffic-vehicle-window { opacity: 0; }
.traffic-vehicle-has-image .traffic-vehicle-mark { z-index: 2; }
```

Use the explicit `traffic-vehicle-has-image` class above; preserve the no-image window styles for fallback.

- [ ] **Step 4: Run type checking and the game logic suite**

Run: `npm run typecheck && npm test -- --runTestsByPath tests/unit/trafficEscapeGameLogic.test.ts`

Expected: both commands PASS; no game-logic test changes are required because rendering does not modify state or rules.

- [ ] **Step 5: Commit page integration and generated assets**

```bash
git add src/pages/traffic-escape/index.tsx src/pages/traffic-escape/index.scss asset-backups/cloudbase-images/games/traffic-escape
git commit -m "feat: add cartoon traffic escape vehicles"
```

### Task 4: Upload, verify, and manually validate the mobile game

**Files:**
- Modify: only files corrected by verification failures from Tasks 1-3

- [ ] **Step 1: Upload the verified backup assets when CloudBase credentials are available**

Run: `npm run assets:upload`

Expected: six files upload below `assets/games/traffic-escape/`; do not claim remote availability if credentials or CloudBase CLI are missing.

- [ ] **Step 2: Run the full automated quality gate**

Run:

```bash
npm run assets:check && npm test && npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check && git diff --check
```

Expected: all commands exit 0. A `punycode` deprecation warning is non-blocking only if the WeChat build ends with `Compiled successfully`.

- [ ] **Step 3: Verify the exact change set**

Run:

```bash
git diff adc061a..HEAD -- src/config/remoteAssets.ts tests/unit/remoteAssets.test.ts src/pages/traffic-escape asset-backups/cloudbase-images/games/traffic-escape
```

Expected: only resolver wiring, generated car assets, CSS overlay/fallback behavior, and its tests.

- [ ] **Step 4: Validate in WeChat Developer Tools or on a device**

Open `pages/traffic-escape/index`, start both normal and hard modes, and confirm: every color uses its matching cartoon vehicle; horizontal and vertical cars retain correct orientation; selected outline and hint pulse remain visible; each car remains touchable across its full grid area; target red car exits normally; and temporarily unavailable images retain a readable pure-color fallback.

- [ ] **Step 5: Commit any verification-only corrections, only when a correction was necessary**

```bash
git status --short
git add src/config/remoteAssets.ts tests/unit/remoteAssets.test.ts src/pages/traffic-escape/index.tsx src/pages/traffic-escape/index.scss asset-backups/cloudbase-images/games/traffic-escape
git commit -m "fix: polish traffic vehicle rendering"
```

Do not create this commit when no correction was required, and do not stage paths outside this list.
