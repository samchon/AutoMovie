# {{name}}

An [automovie](https://github.com/samchon/automovie) project. automovie is a
deterministic motion-control engine for character and object animation: you emit
thin, legible intent — action verbs, or clips you compute in code — and the
engine synthesizes the dense per-frame motion, ROM-checks it, compiles camera
moves, and plans renders. **Engine enforces, model creates.**

There are two ways to drive it, and this starter shows both.

## 1. The MCP path — an agent drives the pipeline

`automovie.config.jsonc` registers the `@automovie/mcp` server with your MCP
client (Claude Desktop, Codex, Claude Code, …). Copy its `automovie` entry into
your client's config; the server runs over stdio. Then, in a session:

- `getGuideDocument({ name: "AUTOMOVIE_OVERALL" })` for the overview,
- `openProject({ root: "." })`, then let `nextSteps()` steer the ladder:
  `stage → block → perform → cut → forge`.

Every failure comes back as field-located violations for the correction round,
never a thrown error.

## 2. The direct-link path — your code is the client

Import the packages and program against the types themselves — the same
primitives the MCP server exposes, with no protocol in between. `src/motion.ts`
**computes** a clip (motion authoring is, at the limit, a coding activity), and
`src/main.ts` runs it through `validateMotion` (engine enforces) and
`sampleMotion` (engine plays):

```bash
npm install
npm run perform
```

Bump the peak angle in `src/main.ts` past the shoulder's anatomical range and
the engine refuses the clip — that refusal is the whole point of the split.

## Which path?

Use **MCP** for orchestrated film state, cross-session persistence, and the
guided correction loop. Use **direct linking** for code-native motion authoring,
custom synthesizers injected into `performShot`, and host integrations. The two
compose: compute a clip in code, enforce it on the same engine, whichever door
you came through.
