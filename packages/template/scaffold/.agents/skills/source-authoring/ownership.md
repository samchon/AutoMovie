# Source Ownership

The coding agent owns `src`, `docs`, `test`, and declared assets. AutoMovie owns tracked design records under `automovie`; review observations remain in evidence citations and Git rather than a second project ledger. The compiler alone owns `generated`. Render commands own content-addressed `renders`.

Deterministic derived artifacts have their own owner inside `automovie`. An explicit generation script you write publishes the exact bytes under `automovie/derived/` and the ledger that records their basis; compilation verifies both and never regenerates either. Hand-editing the bytes or the ledger, and registering a derived path in the external asset ledger, are both refused. [Compilation](compilation.md) owns that contract.

`npm run derive:example` is an executable teaching specimen, not this production's generation command or a gate. It reads the fixed scaffold example `src/examples/buildings.ts` and publishes that example's line index so you can inspect or run one complete self-declaring generator and ledger publication. Its success proves only that the example is reproducible and satisfies no production obligation. When production source needs a precomputed result, create a production-named generator script and package command, declare the script itself, every input, and its project-owned output, then run that command explicitly before compiling.

Never patch `generated` to fix a source problem. Its manifest records every compiler-owned path and digest; unowned or modified output blocks compilation. Edit the owning source or design, then run the scaffold compile command or the package compiler API.

Shot source executes in a deterministic boundary. Wall clock, random APIs, process, network, filesystem, timers, and dynamic import are unavailable in the foundation compiler. Use explicit design seeds. A named static runtime import is available for project-relative modules and for the names `@automovie/engine` and `@automovie/archetypes` publish to the sandbox. Other packages and default, namespace, or side-effect bindings are refused at the declaration. An unavailable named engine export is refused by name, and the refusal says whether the engine has no such export or the sandbox withholds one it has. [TypeScript](typescript.md) lists the reachable engine set by the question each family answers. Type-only imports are documentation and disappear before execution.

The build context contains immutable compiler-generated `runtimeModels` and compact `formationRuntime`. `engine.formationSlot` regenerates one exact representative without serializing the group.

It also carries `derivedArtifacts`, whose live basis and output digests the compiler re-verified on this run. A missing or stale one refuses the compile instead of handing source an approximate value.

Source returns a registered thin actor, script, stage, blocking, and performance program, event sample times, optional `enact` clips, optional bounded formation and effect cues, and optionally its own generated models, semantic props, structured built environments, the observation and lineage records those buildings cite, and the fluid, cloth, planting, and service-network domains it stages with the bindings that attach them.

A library owner returns something else and less: no scene, no clock and no staged world. Its `build` receives the address it registered and nothing more, so everything else it needs is arithmetic it does itself or a named import from the engine surface. Completion uses exactly one current semantic carrier: a maps owner returns contexts, a models owner returns models, and a spaces owner returns built environments. Each must be nonempty and the other carriers must be empty. Material, instance, motion, and system sources remain authoring populations until a standalone result carrier exists for them; do not hide one inside another branch's result.

The compiler admits the named export only when its source path, export name, normalized digest, and exact `docs/<branch>/<document>.md#<anchor>` target are the graph-selected owner edge. `source-owner-mismatch` means the registration or stored shot pointer borrowed another reviewed owner, named the wrong export, or no longer matches current source bytes. Repair the citation and runtime registration at that export; do not redirect a global owner table or move helper imports into the owner population.

It does not return a finished scene or shot, model recipes, imported asset bytes, anonymous formation nodes, arbitrary per-member curves, or subjective proof that it met the contract.

AutoMovie runs the engine film pipeline, adds compiler-owned data, and derives realization from current scene, pose, motion, camera, and contract predicates.

Source-owned geometry does not weaken that boundary, it locates it. A mesh your code constructs is source, so it is regenerated from the same bytes on every compile and its determinism is your obligation. A recipe-materialized runtime model, an ingested external asset, and everything under `generated` stay compiler-owned, and a program that tried to hand back one of those would be claiming ownership it does not have.

The dense motion and realization returned by compilation are derived output. Their source of truth is the tracked source plus bounded design and compiler protocol. Fresh reopen must regenerate identical fingerprints and bytes.
