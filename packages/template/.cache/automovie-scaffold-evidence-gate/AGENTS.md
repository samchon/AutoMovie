# AutoMovie production contract

This project begins without a production. Author work in docs, src, test, and declared assets; never mistake the empty design tree for a completed result or translate ordinary code into giant MCP payloads.

## Read before acting

- [.agents/skills/production/SKILL.md](.agents/skills/production/SKILL.md) owns authorship: the shape decision, the production-specific contract, every layer's procedure and gate, evidence staging, self-review, and final review. Read it, then the workflow document it routes to, before drafting anything.
- docs/README.md owns the documentation root and its non-overlapping ownership map.
- The project scripts are the tool surface: `npm run compile`, `npm run preview`, `npm run render`, `npm run verify`, and the capture and inspection commands beside them. Each is ordinary TypeScript in `scripts/`, and reading it is how you learn what it does.

Those skills ship with the scaffold and are this project's own copy of the authoring doctrine. Editing them changes this project alone and carries nowhere, so a doctrine improvement belongs upstream in automovie; a local edit is a fork of the contract every other project still answers.

## Choose the production shape

Set kind in lint.config.ts when authorship begins. A film uses the exact settings -> storylines -> scenarios -> script -> shots -> filmSources ladder. A brief answers one bounded audiovisual question through the exact settings -> briefs -> shots -> filmSources ladder when the result needs no independent storyline/scenario/script refinement; a short or simple demonstration may therefore remain a brief. Both timed shapes also require reviewed production source as a parallel input before film source. A library delivers reviewed design/source branches without a shot or film timeline. Runtime does not choose the shape.

Research and the model, space, material, instance, motion, and system branches are orthogonal. Activate only what the delivery uses:

- research owns exact external sources, used portions, authority, uncertainty, and affected production decisions;
- settings owns production facts, identities, capabilities, limits, units, and delivery conditions;
- models owns fixed bounded representation and stable articulation/surface interfaces;
- spaces owns world/site/building exterior and interior topology, boundaries, openings, levels, routes, and clear dimensions;
- materials owns construction, finish, scale, surface binding, response, and material state;
- instances owns repeated membership, stable ids and transforms, variation, tiers, density, contact, and placement;
- motions owns reusable deterministic change over time;
- systems owns coupled lighting, environment, effects, simulation, sound, service, clock, dependency, budget, and degradation behavior.

Read docs/README.md and every applicable discovery target, principle, and obligation before drafting. Every subject a later layer stages, animates, voices, or observes has a settings owner first, and in a film that owner settles what docs/obligations/subjects.md requires. The film ladder preserves identical filenames, anchored H2 sequences, H3 scenes, H4 beats, nesting, and order through all three prose layers. A brief uses anchored H2 delivery, H3 shot, and H4 observation units without inventing dramatic causality. Outside an optional H1 title, non-narrative hosts use only H2 and film or brief hosts use only H2/H3/H4; no other heading depth may hide authored work.

## Preserve the evidence graph

The complete production kind, stage declarations, and custom claims live in lint.config.ts. Reusable graph mechanics and populations come from `@automovie/evidence`; there is no second project-local configuration file. Shared targets live in docs/discovery, docs/principles, and docs/obligations; named authoring branches hold production hosts, and separately named production target families extend the graph. Never put production facts or host-side evidence tags in shared targets.

Discovery is ordinary H2-population coverage, not a per-unit checklist. Every authored H2 population answers common discovery; settings adds settings discovery, film prose adds film and its own layer discovery, and briefs add brief discovery. H3 and H4 do not repeat it. A retained result names its earliest owner and current realization; a true no-result uses one population-wide exclusion naming the concrete inputs, risks, and sufficient existing owners. Settings backcasts the actual planned film, brief, or library consumers and classifies every independently consequential operative subject before a dependent layer starts.

Stages are disabled -> draft -> evidence -> review. Disabled means no governed host exists. Draft is the first-version authoring stage and contains no evidence tags. Evidence begins only after that version passes scope, addressability, completion, proportionality, placeholder, same-answer, contradiction, and omission audits. Review adds current compiler-issued fingerprints. A child waits until every direct parent is reviewed. Empty active populations, resident disabled hosts, ownerless source files, mismatched narrative identities, and premature tags are hard failures.

The project declaration has one extension seam for production-specific targets: add typed claims to `claims`. The exact shared inventory reserves docs/discovery, docs/principles, and docs/obligations; put production-only targets in docs/production-principles, docs/production-obligations, or another descriptive family. Every local target must be selected by an additive reference, every enabled local target pattern must select at least one file, and no target carries host-side evidence tags. Never delete, filter, copy, replace, or weaken the shared claim set, paths, review requirements, cardinality, no-exclusion rules, host checks, or stage topology to make a build pass.

Every governed source file declares a named exported owner. Model branches require a concrete exported class and select every exported type for exact ownership; motion branches select every exported function and property; space, material, instance, and system branches select every exported type, function, and property. Each selected design owner cites exactly one reviewed design file; the complete branch realizes all H2 units and source principles. Shot and acceptance owners each cite one screenplay scene or brief shot. Production source serializes reviewed settings. Film source performs only global edit and auxiliary-track assembly.

## Author and verify source

src/examples is reading material, not a library or evidence population. Move and adapt a technique into its owning src/models, spaces, materials, instances, motions, systems, or shots branch, or into scripts when its guide identifies an offline derivation. Never import examples into delivered source or grow them into a catalogue of finished content.

scripts/emitDesign.ts initially refuses. After reviewed design and source exist, extend its marked block with explicit imports and `emit` calls for exactly the records this production owns. Preserve the generic setter wrapper, unchanged-record behavior, and project-inventory orphan refusal. It writes and never deletes, so a stopped record remains residue until deleted or derived again. The screenplay index is hand-authored because semantic scene/beat coverage is not derivable without comparing prose to itself. The blank viewer's clear color is neutral infrastructure; if it remains visible in delivery, import its replacement from reviewed production or system source so viewer code does not become a second visual owner.

Never edit generated or renders. Correct authored source, regenerate, and renew stale reviews. Register every distributable asset in automovie/assets.json with source, license, original/current digest, processing, and reasoned consumer. Keep time in seconds, space in right-handed Y-up metres, and randomness in explicit seeds. Shot and film build functions use no clock, network, process, filesystem, or unseeded randomness.

After each complete production-specific contract pass, layer authorship pass, evidence repair, review verification, or authorized stage transition, the author who performed it rereads the complete affected process alone before continuing or handing off. Trace source and authority, earliest owner, dependencies and consequences, claims and exclusions, review, stage, diagnostics, and the next handoff; collect findings through the whole read, repair them together at their earliest owners, and restart after any edit. One complete no-edit round closes this boundary. This does not replace evidence gates or the final two-clean-round whole-production review.

Run capture:install and capture:doctor before the first preview or render. Capture writes actual PNGs under the render root; open them and state what you saw in the evidence citation that claims the work is realized. A citation that names no observation is not a review. Inspection pages help diagnose but do not substitute for delivery evidence.
