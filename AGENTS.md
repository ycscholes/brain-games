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
