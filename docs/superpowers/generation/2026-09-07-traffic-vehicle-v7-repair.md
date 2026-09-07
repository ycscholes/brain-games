# Traffic Escape v7 opacity and rotation repair

## Causes and changes

The v6 generated sources had dark gradient backgrounds. Broad color-key removal also removed opaque tyre and body pixels. v7 regenerates the four new vehicles with a pale beige key, preserves small enclosed highlights from the original RGB image, and fits each cutout uniformly inside its existing atlas slot. Original six slots are unchanged.

The vehicle wrapper applies a 6px inset on each side, so its long dimension is not an exact multiple of its short dimension. Horizontal and rotated viewports now compensate for this inset and use the same uniform scale. The old three-cell -5% background offset exposed roughly 19 source pixels from the preceding atlas row; it is removed in favor of measured centering.

## Generated asset

- Built-in image generation, reference: the existing ten-vehicle atlas.
- Prompt: four right-facing orthographic cartoon vehicles, pink sports car, teal SUV, purple-blue camper, lime tanker; round wheels, opaque tyres, windows and body panels; flat pale beige background; no shadows, labels or logos.
- Generated source filename: `exec-e34f5b66-cffa-4493-b05c-fa8b574064c0.png`; intermediate cutouts are under ignored `tmp/imagegen/traffic-v7/`.
- Final: `asset-backups/cloudbase-images/games/traffic-escape/vehicle-atlas.png`, RGBA 3840 × 640.
- Remote: `assets/games/traffic-escape/v7/vehicle-atlas.png`, ETag `fc2e3d0183765f94bf45ba8e4b0ea00b`.

## Verification

- PNG regression checks measured bounds, wheel-interior disks, body panels, and absence of opaque neighboring-slot pixels within every crop.
- Browser QA uses production SCSS and the production crop helper for all ten horizontal and vertical variants. At 100px cells, two-cell viewports measure 176 × 88 and three-cell viewports 264 × 88 (vertical CSS rounding below 0.02px). Visual review found no neighboring-row fragments.
- Browser evidence: `tmp/imagegen/traffic-v7/browser-qa.png`.
- Full unit suite, typecheck, lint, assets check, WeChat build, secrets and whitespace checks passed. Focused atlas tests also passed after adding the neighboring-slot regression.
- Browser rendering verification does not substitute for WeChat device acceptance; this repair has not been tested on a physical device.
