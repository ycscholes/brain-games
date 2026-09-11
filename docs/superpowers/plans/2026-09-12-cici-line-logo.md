# Cici Line Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, validate, preview, and commit six simple line-art Logo candidates for “Cici的脑部锻炼” without changing application code.

**Architecture:** Each candidate is generated independently with the built-in `image_gen` tool so the six concepts remain visually distinct while sharing one line system. Final 1024×1024 PNG masters live in the existing CloudBase image-backup app-icon folder; a separate contact sheet provides visual QA and selection support but is not loaded by the app.

**Tech Stack:** Built-in Codex `image_gen`, PNG inspection tools (`file`, ImageMagick when available), project asset checks, Git.

---

## File Map

- Create: `asset-backups/cloudbase-images/app-icons/cici-line-logo-a1-v1.png` — symmetric overhead dumbbell candidate.
- Create: `asset-backups/cloudbase-images/app-icons/cici-line-logo-a2-v1.png` — dynamic single-arm curl candidate.
- Create: `asset-backups/cloudbase-images/app-icons/cici-line-logo-b1-v1.png` — brain-and-puzzle candidate.
- Create: `asset-backups/cloudbase-images/app-icons/cici-line-logo-b2-v1.png` — brain-path-and-spark candidate.
- Create: `asset-backups/cloudbase-images/app-icons/cici-line-logo-c1-v1.png` — infinite neural-loop candidate.
- Create: `asset-backups/cloudbase-images/app-icons/cici-line-logo-c2-v1.png` — growth-loop candidate.
- Create: `docs/superpowers/generation/cici-line-logo-v1-preview.png` — six-image visual QA contact sheet.

### Task 1: Generate the A candidates

- [ ] **Step 1: Generate A1 with built-in `image_gen`**

Use the approved common constraints: `logo-brand`, square mobile mini-program app icon, simple white monoline with thick rounded strokes, no text or face, central silhouette, 16% safe padding, full-bleed blue-to-cyan background, no baked rounded corners, no border, no watermark. A1 uniquely shows a brain character symmetrically lifting one simple barbell overhead.

- [ ] **Step 2: Generate A2 with built-in `image_gen`**

Repeat the common constraints. A2 uniquely shows the outlined brain using one arm for a dynamic dumbbell curl, echoing the existing brand concept without facial features.

- [ ] **Step 3: Save the generated masters**

Copy the generated outputs from their `$CODEX_HOME/generated_images/` locations to the two exact A paths in the file map. Do not overwrite the existing `app-icon-daily-brain-training*.png` files.

### Task 2: Generate the B candidates

- [ ] **Step 1: Generate B1 with built-in `image_gen`**

Use the same line weight, safe area, exclusions, and square format. Use a restrained violet-to-coral full-bleed background. B1 embeds one unmistakable puzzle piece into a simple brain outline; it contains no other symbols.

- [ ] **Step 2: Generate B2 with built-in `image_gen`**

Use the same common constraints and violet-to-coral background. B2 shows one continuous path inside a brain outline terminating in a single clean four-point spark.

- [ ] **Step 3: Save the generated masters**

Copy the outputs to the two exact B paths in the file map.

### Task 3: Generate the C candidates

- [ ] **Step 1: Generate C1 with built-in `image_gen`**

Use the same common constraints and a green-to-warm-yellow full-bleed background. C1 is a single continuous infinity loop subtly shaped like two brain hemispheres, with at most two small circuit nodes.

- [ ] **Step 2: Generate C2 with built-in `image_gen`**

Use the same common constraints and green-to-warm-yellow background. C2 combines two simple sprout leaves with one circular neural-growth loop; avoid light bulbs, faces, hands, and extra decoration.

- [ ] **Step 3: Save the generated masters**

Copy the outputs to the two exact C paths in the file map.

### Task 4: Validate the six masters and build the preview

- [ ] **Step 1: Check file type and dimensions**

Run:

```bash
file asset-backups/cloudbase-images/app-icons/cici-line-logo-*-v1.png
identify asset-backups/cloudbase-images/app-icons/cici-line-logo-*-v1.png
```

Expected: exactly six valid PNG images, each 1024×1024.

- [ ] **Step 2: Inspect full-size images**

Open all six masters and reject any candidate containing text, unintended faces, thin/broken lines, baked corner masks, borders, watermarks, unsafe edge placement, or a concept different from its specification. Regenerate only the failing candidate with one targeted prompt correction.

- [ ] **Step 3: Build and inspect a contact sheet**

Create `docs/superpowers/generation/cici-line-logo-v1-preview.png` as a 3×2 grid with each source reduced to 256×256 and a small filename label outside the artwork. Inspect the sheet once at normal size and once reduced to 50% to approximate 128px-per-logo readability.

- [ ] **Step 4: Run repository asset checks**

Run:

```bash
npm run assets:check
npm run secrets:check
git diff --check
```

Expected: all commands exit 0. Do not run `assets:upload`; the approved scope excludes CloudBase and WeChat platform changes.

### Task 5: Commit the generated assets

- [ ] **Step 1: Confirm task-only Git scope**

Run `git status --short` and confirm only the six Logo masters, the preview, and this task's already-approved design/plan documents are selected for the Logo commit. Leave all pre-existing source and `output/official-account/` changes unstaged.

- [ ] **Step 2: Stage exact generated paths**

```bash
git add \
  asset-backups/cloudbase-images/app-icons/cici-line-logo-a1-v1.png \
  asset-backups/cloudbase-images/app-icons/cici-line-logo-a2-v1.png \
  asset-backups/cloudbase-images/app-icons/cici-line-logo-b1-v1.png \
  asset-backups/cloudbase-images/app-icons/cici-line-logo-b2-v1.png \
  asset-backups/cloudbase-images/app-icons/cici-line-logo-c1-v1.png \
  asset-backups/cloudbase-images/app-icons/cici-line-logo-c2-v1.png \
  docs/superpowers/generation/cici-line-logo-v1-preview.png \
  docs/superpowers/plans/2026-09-12-cici-line-logo.md
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add Cici line logo candidates"
```

Expected: the commit contains only the plan, six masters, and the preview.
