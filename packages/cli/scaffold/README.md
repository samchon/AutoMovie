# {{name}}

This is a coding-agent-first AutoMovie production repository. Write treatment,
screenplay, shot builders, motion helpers, effects, audio integration, and tests
as ordinary files. AutoMovie owns bounded design, deterministic generated
output, geometry facts, actual-frame evidence, and review freshness.

## First run

```bash
pnpm install
pnpm compile
pnpm test
pnpm preview -- --shot opening --time 2 --pass beauty
pnpm review:status
```

The sample review queue is deliberately incomplete. Open the PNG printed by
`preview`, read `PRODUCTION_REVIEW` through MCP, and review current evidence.

Register `automovie.mcp.jsonc` with your coding agent. Its first call is
`getGuideDocument({name:"AUTOMOVIE_OVERALL"})`, then `openProject` with this
repository root. Full render and future audio/chunk resume are CLI jobs, not
free-form MCP shell tools.

## Ownership

- `.automovie/design`, `.automovie/reviews`: AutoMovie tracked contracts
- `src`, `docs`, `test`, `public`: coding-agent source and assets
- `generated`: compiler-owned; never edit
- `renders`: content-addressed outputs; never pass an arbitrary screenshot as review evidence

`pnpm lint` type-checks source and runs the production compiler in read-only
mode. `pnpm compile` is the command that may update generated output.
