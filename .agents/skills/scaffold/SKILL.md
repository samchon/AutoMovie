---
name: scaffold
description: Defines how packages/template/scaffold and packages/template/language-contracts are maintained as the self-contained authoring harness every generated project inherits, including its instruction and contract materializers under packages/template/src, five trigger-partitioned contract and production skills, local contract inventory, and negative-probe and generated-consumer verification gates. Use before editing those sources, and to reach the applicable production authoring procedure when authoring production content inside this repository.
---

# Maintaining the scaffold

`packages/template/scaffold` is the empty authoring harness `automovie` stamps out, `packages/template/language-contracts` supplies its creation-selected language module, and the instruction and contract materializers under `packages/template/src` publish both surfaces. A completed regression film fixture lives outside them so generated projects inherit capability and contracts, never another production's content. Treat every change to those sources as a generated-project API change.

## The authoring procedures live with the production

The contract router and procedures that author a production ship inside the scaffold as `contract`, `production-lifecycle`, `evidence-graph`, `source-authoring`, and `review-verification`. A generated project therefore holds its own trigger-partitioned authoring doctrine, and this repository holds exactly one copy of each concern.

Read the applicable shipped [contract](../../../packages/template/scaffold/.agents/skills/contract/SKILL.md), [production lifecycle](../../../packages/template/scaffold/.agents/skills/production-lifecycle/SKILL.md), [evidence graph](../../../packages/template/scaffold/.agents/skills/evidence-graph/SKILL.md), [source authoring](../../../packages/template/scaffold/.agents/skills/source-authoring/SKILL.md), and [review verification](../../../packages/template/scaffold/.agents/skills/review-verification/SKILL.md) skills before interpreting, authoring, or reviewing production content anywhere, including a fixture or an experimental sandbox inside this repository. This maintenance skill does not restate them.

Editing any instruction or contract document under the scaffold or language-contract roots changes what every future generated project is instructed to do. Apply the [documentation skill](../documentation/SKILL.md) writing rules, verify the links resolve from a generated project rather than from this repository, and run the verification gates below.

## The shared contract inventory

`packages/template/scaffold/docs/{discovery,obligations,principles}/{core,design,story,delivery}` and `packages/template/scaffold/docs/upstream/{design,story,delivery}` are an exact reserved inventory shipped inside the scaffold by `@automovie/template`. The physical family/domain boundary is part of the contract: `core` holds cross-shape foundations, `design` holds maps, objects, materials, instances, motion, systems, and building space work, `story` holds the film ladder, and `delivery` holds briefs, shots, and release inputs. Object, map, motion, interior, and exterior productions share the design domain but remain separate active branches, so the directory partition must never collapse them into a video-only or undifferentiated design checklist. `@automovie/evidence` pins every family/domain filename and ordered H2 anchor, so adding, removing, renaming, moving, or reordering a shared H2 without the matching wiring fails the graph while it loads.

Changing that inventory means changing the target document, `EXPECTED_CONTRACTS`, the claim or reference that selects it, the evidence package's direct logic cases, and the routing guidance in `docs/README.md` and the shipped skill, in one coherent change. A new target family also joins the reserved directory set and the contract walk. Do not recreate the deleted repository-shape probe by counting scaffold files or matching their current text.

## Why maps is a separate design branch

The scaffold provides `docs/maps -> src/maps` rather than widening spaces or excluding world authorship. The product requirements and world-and-site specifications require a production author to create and verify broad terrain, water, ecology, land use, settlements, transport, infrastructure, weather, time state, and world-scale placement. Treating those as engine-owned or external-only would leave those promises with no author, while putting them in spaces would mix world content and networks with site and building containment, envelope, opening, route, and clear-dimension decisions that change and fail independently.

Map therefore owns the broad world's resolved extent, coordinates, feature content, networks, state, and each site boundary and external access node. Spaces consumes that boundary and node and owns the site and building topology within it. Instances and systems may consume map identities and state without absorbing them. This direction keeps a terrain, road, or hydrology decision independently reviewable while allowing film, brief, object library, map library, and building library shapes to activate only the branches their delivery needs.

`automovie` owns this production-authoring branch because its generated evidence graph and deterministic source consume it directly. `wrtn-interia` may eventually share or build on the same contract, but a separate unanchored corpus cannot stand in for the current production owner. If the two repositories later extract a shared package, preserve these owner boundaries and migrate one canonical contract rather than maintaining divergent copies.

Classify before adding. A condition every selected authored H2/H3/H4 must answer for itself is a no-exclusion principle checklist. What one inheriting unit learned by exercising its actual parents is an exclusion-permitted upstream checklist: a repair names the earliest corrected parent, while a truthful negative names the concrete parent decisions found sufficient. A role the layer's primary H2 population, or a source family's selected public-export population, covers one or more times as the item requires is a no-exclusion obligation. An open search whose result no checklist can enumerate is a discovery duty, and a production procedure is a skill document rather than a target. A rule that belongs to one production is never added here; it belongs in that production's flat `docs/contracts` population and an additive claim selects the hosts that must enforce it. The scaffold ships only the empty tracked directory: never seed a production rule or negative ledger.

An anchor is a citation address, so choose it for the durable question rather than the current wording. When an item's text changes, reread every citing host against the new text and renew its review from that reading. Replacing only the fingerprint records a check nobody performed.

Retire an item when it is wrong, absorbed, or inapplicable. Inconvenience to one production is not a reason; that production's own local targets are where its exceptions live.

## Verification

After topology, contract, or citation changes, run the scaffold evidence gate. Falsify each new edge or refusal with a disposable negative probe, restore it, and require the normal graph to pass. Build and test the repository, generate a fresh scaffold from packed packages, and prove that its source lint and canaries pass while production design and compile refuse the unselected blank state. Compile the repository-only completed fixture to preserve production regression coverage. Measure every executable position changed in scaffold source at 100% statements, branches, functions, and lines.

Instruction synchronization is an overwrite contract. In a fresh generated project, select representative production shapes through the tracked `lint.config.ts`, run `npm run sync`, and prove that stale `AGENTS.md`, `CLAUDE.md`, and `.agents/skills` content disappears while tracked package, contract, document, and source bytes do not change. Run sync twice and require byte-identical generated instructions. Verify that the root `AGENTS.md` names only the selected shape and exact active owners, that `CLAUDE.md` contains only `@AGENTS.md`, and that the generated instruction paths are ignored. Perform this check from the fresh project root so the expected Codex entry point and Claude Code import resolve there; a parent checkout's `AGENTS.md` is not evidence that the generated project's instructions load.

For render, pose, expression, geometry, material, or motion changes, also follow the applicable [3D modeling](../3d-modeling/SKILL.md) and [viewer verification](../viewer-verification/SKILL.md) skills.

The repository [evidence graph skill](../evidence-graph/SKILL.md) owns committed requirement-to-source traceability for this repository's own packages. The generated-production graph is separate: apply that skill's citation honesty and diagnostic discipline to it, without imposing the requirement-specification-source triangle on a production.
