# Image Generation Workflow

This project uses the built-in Codex `image_gen` tool for all generated bitmap assets.

## Policy

- Use built-in `image_gen` for every generated project image, including pet sprites, app icons, previews, illustrations, and marketing images.
- Do not create project images with hand-drawn placeholder scripts, Pillow-only drawing, SVG stand-ins, Midjourney, Stable Diffusion, DALL-E web prompts, or unrelated external generators unless the user explicitly overrides this policy.
- For transparent PNG assets, use `image_gen` first on a flat chroma-key background, then remove the key locally. Do not claim an asset is final until transparency and file placement are verified.
- Generated assets used by the app must be copied into the repository. Do not leave app-referenced assets under `$CODEX_HOME/generated_images`.

## Pet Sprite Requirements

Current pet sprites live in:

```text
asset-backups/cloudbase-images/pets/
```

The app loads them from CloudBase Storage paths under:

```text
assets/pets/
```

Each pet skin must provide four states:

```text
<skin>-idle.png
<skin>-feed.png
<skin>-cuddle.png
<skin>-hungry.png
```

Recommended final format:

- PNG with RGBA alpha channel
- Transparent background
- Single centered full-body pet
- Subject fits inside the canvas with safe padding
- No floor, no cast shadow, no border, no labels, no watermark
- Visual style should match the existing soft watercolor storybook pet assets

## Built-In Image-Gen Flow

1. Inspect existing reference assets and current dimensions.
2. Write the prompt for built-in `image_gen`; include:
   - use case and asset type
   - subject identity
   - style constraints
   - exact pose/state
   - chroma-key background instructions when transparency is needed
   - negative constraints such as no text, no border, no shadow
3. Generate with built-in `image_gen`.
4. Copy the selected output from `$CODEX_HOME/generated_images/...` into a workspace temp folder.
5. For transparent assets, remove the chroma-key background:

```sh
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input tmp/imagegen/source.png \
  --out tmp/imagegen/final.png \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```

6. Validate alpha, transparent corners, subject bounds, and small-size readability.
7. Move the final files into the project asset directory.
8. Rebuild any preview image that documents or QA uses.
9. Run project checks before committing.

## Chroma-Key Prompt Block

Use this block for transparent-ready pet sprites:

```text
Background: perfectly flat solid #ff00ff chroma-key background for background removal.
The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Do not use #ff00ff anywhere in the subject.
Keep the subject fully separated from the background with crisp edges and generous padding.
No cast shadow, no contact shadow, no reflection, no watermark, no text, no labels, no border, and no frame.
```

Use `#00ff00` instead only when the subject has no green tones. For green subjects such as turtles, prefer `#ff00ff`.

## Pet Prompt Template

```text
Use case: illustration-story
Asset type: mobile mini program pet sprite
Primary request: Create a cute watercolor-style <species> pet sprite matching soft children's game pet art.
Subject: one consistent <species> character with <distinctive features>.
Style: high-quality soft watercolor / plush storybook illustration, similar to kawaii pet game sprites, warm hand-painted texture, clean silhouette, no harsh vector outlines.
Composition: single full-body centered pose with generous transparent-safe padding.
Pose: <idle | feed | cuddle | hungry pose description>.
Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #ff00ff anywhere in the subject.
Constraints: transparent-ready cutout subject, crisp edges, no cast shadow, no contact shadow, no text, no labels, no watermark, no border, no frame.
```

## Verification

Run these checks for pet asset changes:

```sh
npm run assets:check
npm test -- --runTestsByPath tests/unit/remoteAssets.test.ts tests/unit/birdCountGameLogic.test.ts
npm run typecheck
npm run lint
npm test
```

Also inspect the generated preview image before committing.
