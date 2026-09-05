# Design branches

Activate only branches the declared delivery actually owns. Film, brief, and library describe the output shape; they do not decide whether a production needs a model, world, building, finish, crowd, motion, light, effect, sound, or service. Every active branch advances from document to matching source after reviewed settings, and every source owner cites exactly one design file.

## Branch routing

| Branch | Owns | Does not own |
| --- | --- | --- |
| `docs/models -> src/models` | fixed bounded representation, geometry, hierarchy, articulation interface, surface partitions, fidelity ceiling | fictional identity, material response, placement population, timed change |
| `docs/maps -> src/maps` | broad-world extent and coordinates, terrain, water, ecology, land use, settlements, transport, infrastructure, weather, time state, and world-scale placement | site and building topology inside an adopted boundary, object construction, finish, dramatic composition |
| `docs/spaces -> src/spaces` | site/building exterior and interior, containment, adjacency, shared envelope, openings, levels, local routes, clear dimensions | broad-world content and networks, object mesh, finish, camera path |
| `docs/materials -> src/materials` | construction, finish, texture/projection scale, surface binding, optical/physical response, material state | host geometry or topology |
| `docs/instances -> src/instances` | prototype membership, stable ids, transforms, variation, LOD tiers, density, placement and overlap | prototype construction or reusable time transition |
| `docs/motions -> src/motions` | named deterministic state transition, endpoints, phases, paths, contacts, parameters, composition and interruption | capability authorization or target interface construction |
| `docs/systems -> src/systems` | coupled lighting, environment, effects, simulation, sound, services, clocks, budgets, dependencies and degradation | identities and structures consumed by the process |

## Ownership direction

Use settings for what exists, what it means, what it may do, and the production-wide coordinate and time conventions. Map specializes those conventions into the broad world's resolved extent, features, networks, and states. It owns a parcel or site boundary and the external road or path through one named site-access node; spaces consumes that boundary and node, then owns site and building containment, envelope, openings, dimensions, and routes inside them. A settlement-scale footprint may locate a building in a map, but the building's exterior and interior are two views of one space/envelope topology, not competing map or model files.

A model exposes stable surface ids; a material binds to them. An instance points to a reviewed prototype and a reviewed map or space placement when one governs it; a silhouette-changing member returns to models. Motion changes one reviewed interface over time; a system coordinates processes or many owners.

Classify a staged object by responsibility rather than asset shape: a story prop retains action, contact, state, and continuity identity, set dressing retains a place, period, access, activity, or visual-organization function, and structural enclosure or circulation returns to spaces. A style label is not a design result until its observable geometry, proportion, layer, surface, or abstraction consequences have owners.

The shared graph follows ownership direction: maps may supply foundations to spaces, instances, and systems; models may consume spaces; materials consume model or space surfaces; instances consume map or space placement, model prototypes, and declared material variation; motions may consume any other reviewed design interface; systems may consume maps, models, spaces, materials, instances, and motions; briefs account for every active design branch. Motion and system documents may therefore cite one another when a coupled process and a reusable transition have distinct owners; neither may duplicate the other's state or path. These populations divide the cited targets among the hosts that actually use them. Omission from an unrelated host is not an exclusion; only a target unused by the complete host population receives one truthful population-wide exclusion. When a foundation branch later reaches review, its targets reopen every affected downstream review without serializing otherwise independent drafting.

## Discovery and draft procedure

Before an active design branch enters `draft`, run its contract-hosted discovery pass against the actual production: `discovery/core/common.md`, `discovery/design/designs.md`, and the matching `discovery/design/<branch>.md`. Inspect the reviewed settings, direct directives, source assets and provenance, dependencies, planned consumers, promised observations, and known failures without turning those inputs or the target prose into a predetermined answer list. A film or brief runs this pass only for the design branches it actually activates; a library runs it for every design branch it delivers even though it has no narrative, brief, shot, or edit population.

Keep the three scopes distinct. `common.md` searches for production-wide and cross-layer rules, `designs.md` searches for conditions that must remain compatible across active design branches, and the branch file searches for conditions only that specialist population can own. `films.md` and `briefs.md` govern their timed authored populations and do not replace or enter design discovery. A production with no timed output still owes the complete applicable design search.

Discovery is not testimony on a design H2. Record a retained result once in the flat `docs/contracts` file that states the adopted rule, give it one earliest settings or design H2 owner and its current realization, and add the typed claim that enforces the result over every affected authored or source population. Record a true no-result only as the one concrete population-wide exclusion on `docs/contracts/index.md`. A label, deferred decision, generic shared answer, or active branch with an empty contract audit is not completion.

Research remains a separate decision. When design discovery exposes a consequential external question, activate `docs/research` only if the source identity, used portion, uncertainty, and production consequence need a durable ledger; interpret an adopted finding through settings before a design branch consumes it. The optional research population keeps its own discovery scope and does not acquire a design target merely because it supports design authorship.

After discovery is settled and before drafting a branch, read its principle and obligation files in full, inventory independent owners, and run the same-answer test: if two proposed H2s would receive materially the same answer, merge or sharpen them. Then run the contradiction test in both directions: ask whether one item could pass while the other fails, and whether each can change without changing the other. Record interfaces as citations rather than copying decisions across branches.

## Gates

Start an applicable design layer at its `<branch>: "draft"` key only after settings are in `review` and its contract-hosted discovery result is settled. Before `evidence`, require a complete first version, stable H2 owners, no placeholders, all inherited settings and reviewed-foundation citations, every matching principle answered by every H2, every matching obligation allocated across the H2 population, and the branch's finite review set and verification addresses. Run [Author process Self-Review](../review-verification/self-review.md) to a clean round before each stage transition and after every repair. Follow [Evidence staging](../evidence-graph/staging.md) for evidence and review passes.

| Branch gate | Specialist contracts before `evidence` | Matching source starts only after |
| --- | --- | --- |
| `maps` | `principles/design/maps.md`, `obligations/design/maps.md`, and `discovery/design/maps.md` | `maps: "review"`, then `mapSources: "draft"` with `obligations/design/map-sources.md` |
| `spaces` | `principles/design/spaces.md`, `obligations/design/spaces.md`, and `discovery/design/spaces.md` | `spaces: "review"`, then `spaceSources: "draft"` with `obligations/design/space-sources.md` |
| `materials` | `principles/design/materials.md`, `obligations/design/materials.md`, and `discovery/design/materials.md` | `materials: "review"`, then `materialSources: "draft"` with `obligations/design/material-sources.md` |
| `instances` | `principles/design/instances.md`, `obligations/design/instances.md`, and `discovery/design/instances.md` | `instances: "review"`, then `instanceSources: "draft"` with `obligations/design/instance-sources.md` |
| `systems` | `principles/design/systems.md`, `obligations/design/systems.md`, and `discovery/design/systems.md` | `systems: "review"`, then `systemSources: "draft"` with `obligations/design/system-sources.md` |

Read [Models and motions](models-and-motions.md) when either of those branches is active; that document owns their corresponding gates. Do not import model or motion questions merely because all branches may become rendered geometry.

## Specialist observation routes

Read [Spatial design](spatial-design.md) whenever maps or spaces are active, and when materials or instances have spatial consequences; use it to judge maps, plans, sections, elevations, perspectives, traversals, surfaces, networks, and repeated populations without transferring their semantic ownership.

Read [Building reports](../review-verification/measurements.md#building-reports) when current compiled shots stage a built environment whose spatial or system review needs drawings, schedules, quantities, services, or declared studies.

Read [Texture scale](../review-verification/measurements.md#texture-scale) when a review depends on a physical or normalized texture scale surviving the geometry that receives it.

Read the reported census or empty-population state; command availability and exit code alone never complete the review set.

A library-only space branch is drawn by `building:report` from what it materialized, so it needs no shot; never create a dummy one to make the command run. What it does not have is frames, and the report says so in its own tally, which is what a review citing a materialized building has to cite.
