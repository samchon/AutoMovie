---
name: evidence-graph
description: Defines this generated project's self-contained contract inventory and evidence obligations. Use before adding or changing discovery, upstream, obligation, principle, or local contract documents; editing lint.config.ts graph state or claims; adding evidence tags, exclusions, reviews, or fingerprints; or advancing a branch stage. Do not use for frame-review evidence or geometry craft except where they pay a declared graph relationship.
---

# Evidence graph

The complete contract inventory lives in this project's `docs/{discovery,upstream,obligations,principles}` tree. `lint.config.ts` is the single typed declaration of production kind, population scope, branch stages, custom claims, and the resulting graph. No installed package path, secondary evidence config, or hidden provider hook owns part of this contract.

Read `lint.config.ts`, `docs/README.md`, the active host population, and every selected target before changing a governed artifact. Reusable graph mechanics come from `@automovie/evidence`; the generated project owns the target bytes and may update them only as an explicit contract revision with every consequence traced.

## Required routes

Read the applicable sibling in full before acting:

- [Contract targets](contract-targets.md) defines discovery, upstream, principle, obligation, and source target forms.
- [Production-specific contract](work-specific.md) classifies direct instructions and additive local targets under `docs/contracts`.
- [Upstream revision](upstream.md) governs shared inherited-unit duties when an owner changes.
- [Evidence staging](staging.md) owns populations, citations, exclusions, `disabled -> draft -> evidence -> review`, diagnostics, and fingerprints.
- [Conformance owner map](conformance.md) routes semantic, structural, freshness, rewrite, and repair failures to one canonical owner after the retired conformance meta-principles.

## Invariants

Discovery is an open-world contract audit, not a checklist copied onto authored units. Retained results become flat files under `docs/contracts`; a true no-result belongs only in `docs/contracts/index.md` and names the examined inputs, risks, and sufficient existing owners.

Draft hosts contain no evidence tags. Evidence begins only after the authored version passes scope, addressability, completion, proportionality, placeholder, same-answer, contradiction, and omission audits. Review adds current compiler-issued fingerprints. A child waits until every direct parent is reviewed.

Never weaken the harness to make a build pass. Do not reduce a stage, narrow a population, delete or filter a shared claim, invent a fingerprint, or exclude a target the production owes. A tag records a relationship that already holds; it is never written merely to clear a diagnostic.

Every governed source file declares a named exported owner and pays the exact reviewed design or delivery target selected by its branch. Production-local claims extend the shared graph through `claims`; they never replace it.

## Verification

After each complete contract pass, evidence repair, or authorized stage transition, reread the whole affected process, collect every finding, repair them at their earliest owners, and restart after an edit. One complete no-edit round closes that boundary. Run `npm run lint:source` for typed configuration and `npm run lint -- --scope source` for the live graph; use the full review gate only when the production is meant to answer it.
