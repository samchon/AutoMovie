# Production lifecycle

You are authoring one production: this project. Read `AGENTS.md`, `lint.config.ts`, `docs/README.md`, every active upstream layer, and every contract selected by the evidence graph before drafting. Write only what the user requested. Do not create placeholder files, headings, or invented production content.

## Ordered procedure

Before first-version drafting while a layer is disabled, read the exact contract inventory routed by `AGENTS.md` and `lint.config.ts`. Apply unit-level principles from the beginning, but defer population-distribution and post-draft questions until their complete selected population exists. A contract annotation records work already done and never substitutes for authorship.

Select the production kind and settle complete settings before downstream work. Activate only the next applicable layer whose direct parents are reviewed, author one coherent version, stage its evidence, review it, and only then open its child. A later finding returns to the earliest semantic owner, propagates through every affected descendant, and renews their evidence and review.

Apply this procedure without subject-matter shortcuts. Historical, biographical, familiar, externally documented, or technically standardized material still needs explicit project canon, selected design owners, source realization, and current review. External knowledge supports an owner; it never replaces one.

Do not partition one authored layer into release and non-release populations. Treatments own the complete narrative-event population without delivery groups, scripts own the complete delivery partition, and screenplays preserve it. A library branch likewise owns the complete declared reusable subject. Population narrowing exists only through the explicit pilot mode and its synchronized reset.

Record authorship and assistance truthfully in Git history and durable source provenance where the production contract calls for it. Do not move process history into current canon, attribute generated output as human observation, or treat tool assistance as authority for a production fact.

Choose exactly one shape in `lint.config.ts`:

- a film follows `settings -> treatments -> scripts -> screenplays -> shots -> filmSources`;
- a brief follows `settings -> briefs -> shots -> filmSources`;
- a library follows settings plus only the design and matching source branches it delivers.

Film and brief also require reviewed `productionSources` as a parallel input before `filmSources`. Runtime never chooses the production shape.

## Generated instructions

`AGENTS.md`, `CLAUDE.md`, and `.agents/skills` are ignored generated instructions. `npm run sync` deletes and replaces that surface from the installed template, then renders the root router from `package.json`, `lint.config.ts`, active authored owners, and `docs/contracts`. Change production facts only in tracked owners and run sync again; do not preserve a local doctrine fork.

Start the coding-agent session from this project root after sync. Codex loads `AGENTS.md`; Claude Code follows `CLAUDE.md -> @AGENTS.md`.

## External retrieval

Use web search where settings, research, or a discovery target requires an externally checkable search. Search results and collection portals are routes, not evidence: open the primary record, official specification, scholarly work, critical edition, or direct technical source before accepting a claim. A source that blocks automated retrieval is blocked, not absent; record that limit and reduce precision or return the claim to unresolved instead of attaching a broad portal. Search never substitutes for the authored owner a contract requires.

## Lifecycle routes

Read each applicable sibling document in full before acting:

- [Production kinds](production-kinds.md) selects the shape and states its refusals.
- [Vertical-slice pilot](pilot.md) proves one truthful film or library slice at full contract strength before expansion.
- [Research](research.md) owns the optional external-source ledger and its downstream use.
- [Settings](settings.md) owns delivery, canon, subjects, capabilities, constraints, and shared conventions.
- [Treatments](treatments.md), [scripts](scripts.md), and [screenplays](screenplays.md) own the film-only refinement ladder.
- [Direct briefs](briefs.md) owns bounded audiovisual delivery that needs no independent narrative ladder.
- [Production delivery decisions](configuration.md) explains the delivery, repaint, dialogue, and simulation fields of the design record; read it before source authorship.
- [Upstream revision](upstream-revision.md) repairs the earliest parent exposed by a child and preserves the child until coherent resumption.

Map, model, space, material, instance, motion, and system design plus TypeScript implementation belong to [Source authoring](../source-authoring/SKILL.md). Contract inventory, citations, stages, and fingerprints belong to [Evidence graph](../evidence-graph/SKILL.md). Review, capture, inspection, and final acceptance belong to [Review verification](../review-verification/SKILL.md).

## Ownership and consequence

Research owns external source identity, used portion, authority, uncertainty, and affected production decisions. Settings owns production facts, identities, capabilities, limits, access, units, and delivery conditions. Treatments own detailed narrative development, scripts own executable physical progression and consequential exchange, screenplays own the final visible and audible audience contract, and briefs own one bounded delivery/shot/observation hierarchy.

Correct the earliest owner when a later layer exposes a defect, propagate the consequence, and renew every affected review. Every subject a later layer stages, animates, voices, or observes has a settings owner before that use, including extras, crowds, machines, and institutions. Backcast the literal cast after every downstream draft or revision.

## Working memory and reader editions

Use the ignored `.wiki/` for local ideas, research, questions, and continuity aids. Nothing there binds the production; promote every retained fact or decision into its canonical `docs` owner and never commit `.wiki`.

Run `npm run book -- --layer <layer> --title <title>` for a deterministic reader-facing Markdown edition. The command writes only beneath ignored `artifacts`, removes evidence comments and citation anchors, preserves visible prose and headings, and never edits authored documents.

## Handoff

Before handing a lifecycle layer to evidence staging or source authorship, reread the complete applicable process, trace authority and dependencies, collect all findings, repair them at their earliest owners, and restart after an edit. One complete no-edit round closes the lifecycle boundary; it never replaces the graph gates or final review.
