# Agent Instructions

<!-- context7 -->
Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Always start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format.
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries.
3. `query-docs` with the selected library ID and the user's full question, not single words.
4. If you weren't satisfied with the answer, call `query-docs` again for the same library with `researchMode: true`.
5. Answer using the fetched docs.
<!-- context7 -->

## Git Workflow

- After making any code change, run the relevant verification commands, stage only the files related to that task, and create an automatic `git commit`.
- Do not include unrelated existing worktree changes in the commit.
- If verification or commit cannot be completed, report the exact command, failure reason, and affected files.

## Gameplay and Points Economy

- Any new game, game rewrite, scoring change, difficulty change, training record change, or pet reward change must stay aligned with `docs/points-economy.md`.
- Award pet points only through the shared points pipeline (`getAwardedPoints()` and `addPointsToPet()`); do not hand-roll game-specific multipliers or caps in page components.
- When changing a game's score range, difficulty mapping, `gameId`, mode format, or reward behavior, update `docs/points-economy.md` and the relevant unit tests in the same task.

## Image Generation Workflow

- For all generated project images, use the built-in Codex `image_gen` tool.
- Do not generate project image assets with Pillow-only drawing scripts, SVG placeholders, Midjourney, Stable Diffusion, DALL-E web prompts, or other external generators unless the user explicitly overrides this.
- For transparent PNG assets, generate with `image_gen` on a flat chroma-key background, remove the key locally, validate alpha/edges/bounds, and save the final asset into the repository.
- Follow `docs/superpowers/generation/image-gen-asset-workflow.md` for pet sprites and other generated bitmap assets.

## Remote Asset and Package Size Workflow

- App image assets that can materially increase the WeChat Mini Program package size should be stored under `asset-backups/cloudbase-images/`, uploaded to CloudBase Storage, and loaded from remote paths such as `assets/pets/`.
- Do not add new pet sprites, pet food icons, or other reusable generated bitmap asset packs under `src/assets/` unless the user explicitly asks for local bundling.
- After adding or replacing CloudBase-backed images, run `npm run assets:check`; run `npm run assets:upload` when the task requires refreshing the remote Tencent Cloud / CloudBase copies and credentials are available.
