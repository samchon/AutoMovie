# Guide Corpus

The exact allowlist in `build/prompt.mjs` names every Markdown guide served by `AutoMovieApplication.getGuideDocument`. The build bundles only those filename stems into the generated `src/guides/AutoMovieGuideConstant.ts`; edit Markdown, never the constant. `README.md` documents the corpus and is not served.

## Document classes

- `AUTOMOVIE_OVERALL` is the constitution and prose router. An external agent that has read only this document must be able to select the next guide.
- MCP gate guides use contract and diagnostic-catalog language. They name the exact tool, inputs, success evidence, refusals, recovery order, and boundaries they cannot judge.
- Handbooks use cookbook language. They teach decisions made in repository files or ordinary APIs that the five-tool server cannot intercept.
- Record and compiler guides explain typed owners and deterministic boundaries. Interface types and JSDoc remain the primary payload contract; guides add patterns and domain judgment.

## Writing rules

- Ground every behavioral claim in current interface, service, compiler, engine, renderer, or scaffold behavior.
- Address the coding agent as “you”. State the observable rule, why it matters, and a correction recipe.
- Keep TypeScript examples in fenced blocks tagged `ts`. Every tagged snippet is compiled by the prose contract test against workspace package declarations. Use `text` for deliberately incomplete fragments.
- Write an engine function in call form (``` `tessellateSurface(` ```) only where shot source may call it. Call form is what the corpus contract test reads as a claim that `AUTOMOVIE_SANDBOX_ENGINE_SURFACE` publishes the name, so a function only a `scripts/` module can reach is named bare instead. A bare mention, a type name, and a member call claim nothing and are never checked.
- Let a `ts` example that is shot source name only `@automovie/engine`, `@automovie/archetypes`, `@automovie/interface`, and project-relative modules, and mark every type binding in it `type`. The test reads such an example through the compiler's own import gate, so an unmarked type binding is refused exactly as it would be in a real shot module. An example that runs outside the sandbox names the package it actually runs against, which is how the test knows to leave it alone.
- Do not preserve retired server vocabulary as history, migration advice, or comparison. Git history owns history.
- When an MCP tool changes, update its declaration table, exact gate guide, constitution route, and prose contract in the same topic.
- Time-sensitive recommendations, especially diffusion models and asset services, instruct the agent to research the current state instead of freezing a brand name as eternal truth.

The corpus contract test pins served-name closure, tool-to-guide linkage, all five tool-name mentions, required doctrine, retired-call absence, old-file removal, routing closure, TypeScript snippet compilation, and sandbox reachability of every name a guide presents as callable.
