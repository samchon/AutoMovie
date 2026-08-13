# Guide Corpus

The exact allowlist in `build/prompt.mjs` names every Markdown guide served by `AutoMovieApplication.getGuideDocument`. The build bundles only those filename stems into the generated `src/guides/AutoMovieGuideConstant.ts`; edit Markdown, never the constant. `README.md` documents the corpus and is not served.

## Document classes

- `AUTOMOVIE_OVERALL` is the constitution and prose router. An external agent that has read only this document must be able to select the next guide.
- MCP gate guides use contract and diagnostic-catalog language. They name the exact tool, inputs, success evidence, refusals, recovery order, and boundaries they cannot judge.
- Handbooks use cookbook language. They teach decisions made in repository files or ordinary APIs that the server cannot intercept.
- Record and compiler guides explain typed owners and deterministic boundaries. Interface types and JSDoc remain the primary payload contract; guides add patterns and domain judgment.

## Writing rules

- Ground every behavioral claim in current interface, service, compiler, engine, renderer, or scaffold behavior.
- Address the coding agent as “you”. State the observable rule, why it matters, and a correction recipe.
- Keep TypeScript examples in fenced blocks tagged `ts`. `test_mcp_guide_snippet_compilation` compiles every tagged snippet against the workspace packages under the scaffold's own compiler options, which is the configuration a generated production is written against. Use `text` for deliberately incomplete fragments.
- Write an engine function in call form (``` `tessellateSurface(` ```) only where shot source may call it. Call form is what `test_mcp_guide_surface_reachability` reads as a claim that `AUTOMOVIE_SANDBOX_ENGINE_SURFACE` publishes the name, so a function only a `scripts/` module can reach is named bare instead. A bare mention, a type name, and a member call claim nothing and are never checked.
- Let a `ts` example that is shot source name only `@automovie/engine`, `@automovie/archetypes`, `@automovie/interface`, and project-relative modules, and mark every type binding in it `type`. `test_mcp_guide_surface_reachability` reads such an example through the compiler's own import gate, so an unmarked type binding is refused exactly as it would be in a real shot module. An example that runs outside the sandbox names the package it actually runs against, which is how that case knows to leave it alone.
- Never write a template-literal placeholder in a guide, in prose or inside a fence. `build/prompt.mjs` embeds each document through `JSON.stringify`, so the sequence lands inside an ordinary double-quoted string in the generated constant, where `no-template-curly-in-string` is an error. The cost is not the one guide: a lint error makes `ttsc` emit the whole `mcp` barrel as an empty module, so every consumer reports a missing function and nothing anywhere names the guide that caused it. Build the string with concatenation in an example that needs one. This is the rule authors break first, because a template literal is the natural way to write the example.
- Do not preserve retired server vocabulary as history, migration advice, or comparison. Git history owns history.
- When an MCP tool changes, update its declaration table, exact gate guide, constitution route, and prose contract in the same topic.
- Time-sensitive recommendations, especially diffusion models and asset services, instruct the agent to research the current state instead of freezing a brand name as eternal truth.
- Never write the size of a published family as a word or a digit. `WORLD_BUILDING` called the built-environment queries "the six" while eight were reachable, and the sentence was already wrong on the day it was written; a later addition updated the names beside it and left the number alone. Say "that is the whole family" and let the reader count, or name the derived index that owns the number. A count typed into prose is a claim nothing recomputes.

A set of cases holds this corpus to the surfaces it teaches, and the suite itself is where to read which. `test_mcp_guide_corpus_closure` pins that the authored Markdown and the served names are one set and that `AUTOMOVIE_OVERALL` names every other served guide. `test_mcp_guide_snippet_compilation` compiles every `ts` example. `test_mcp_guide_surface_reachability` refuses a name a guide writes in call form that the sandbox does not publish, and a shot-source example carrying an import the gate would reject.

Nothing gates a guide's prose. Fixed lists once pinned doctrine sentences, tool-name mentions, retired call vocabulary and retired guide filenames; `#1900` removed that class of check as repository shape rather than product behavior, and they are not coming back. The writing rules above are what holds them, and review is what enforces them.

`test_mcp_guide_capability_question_coverage` asks the return direction, because reachability and teaching are different properties and only the first was ever gated. Every reachable engine function must appear in call form in some guide's prose, every reachable base class must appear nowhere in call form, and the names excused from being taught as callable must be exactly the classes the engine publishes. Nothing declares an exemption: a capability the corpus should not teach as callable has no way to say so, which is deliberate, because the alternative is a list of excused names and that list never shrinks. Adding a name to `AUTOMOVIE_SANDBOX_ENGINE_SURFACE` is therefore an edit to this corpus as well, and the suite says so before review does.
