# D002. Interface types stay rough

## Decision

`@automovie/interface` carries plain primitives. A duration is a `number`, an id is a `string` — no wrapper aliases, no `typia` tag constraints (`Minimum`, `MinItems`, `Format`). Units and ranges are documented in field JSDoc and enforced at runtime by `engine` validators. The only structural constraints allowed are closed `AutoMovie*` unions (bone names, ARKit channels, presets, easing), because those are allowed-value sets, not wrappers.

## Why

`interface` is the AST an LLM emits against. Every constraint pushed into the type is a constraint the model must satisfy blind, at generation time, with a schema error as its only feedback. Every constraint left in the validator is one the model receives as a **field-located violation it can act on** — which is the correction loop the whole product is built around.

The rule also keeps `interface` free of any runtime dependency: constraint tags would drag `typia` into a package that must stay pure types. The last such tag and that dependency were both removed for this reason.

## Where it binds

- `packages/interface/**` — no runtime dependency; ranges live in JSDoc.
- `packages/engine/src/validation/**` — where those ranges are actually enforced.
- `.agents/skills/development/SKILL.md` — "Rough types in `interface`".

## Relations

Extended by [D003](./D003-named-scalars-for-llm-quaternions-for-engine.md), which applies the same "author in the model's vocabulary, lower it in the engine" split to rotation.

@author Samchon
