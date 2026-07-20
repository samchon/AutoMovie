---
name: documentation
description: Defines the .wiki/ working knowledge base, package README, code JSDoc, and agent-instruction conventions for automovie. Use before writing or modifying docs, AGENTS.md, or a SKILL.md, and revise the wiki as the work proceeds, not at the end.
---

# Documentation

## The `.wiki/` knowledge base

`.wiki/` (gitignored) is automovie's durable, cross-session knowledge base, written in Korean. It is the first thing to read at session start and must be revised as the work proceeds, not at the end. Layout: `00-governance` (operating manual, reading ledger), `01-progress` (current state, next priorities), `02-overview` (product), `03-philosophy` (the two harness articles + principles), `04-domain-research` (external study), `05-references` (agentica/autobe/interia), `06-architecture` (monorepo + per-package design), `07-decisions` (append-only decision log), `08-campaigns` (issue-campaign knowledge bases), `09-benchmarks` (benchmark-campaign corpus and run records), `99-worklog` (dated logs).

- Record a design choice in `07-decisions/` (append-only; a later entry supersedes an earlier one) the moment it is made.
- Promote it to `docs/decisions/` when shipped code will cite it as authority (see below). The two logs have separate numbering and are not mirrors of each other.
- Update `01-progress/README.md` whenever a package or capability lands.
- Keep `06-architecture/` matching the code; when generalizing the rig/engine model, the design doc precedes or accompanies the code.
- Separate confirmed fact (with file paths) from inference, and cite external sources by URL. References and domain study are evidence, not authority; do not transplant them verbatim.

## Version-controlled decision records

`docs/decisions/` holds the `D0xx` records, in English, committed to the repository. It exists because `.wiki/` is gitignored: a reviewer or agent holding only a clone must be able to resolve a `(D015)` citation in shipped JSDoc, and cannot resolve one that lives only on a maintainer's disk.

Cite a decision as the bare identifier — `(D015)` — and only from this series. `test/src/features/docs/test_docs_decision_records.ts` fails on a citation with no record, a record missing from the index table, and a record missing a standard section, so the two cannot drift.

Promote a `.wiki/07-decisions/` entry here when code starts binding itself to it. Write the record to `docs/decisions/README.md`'s contract — Decision, Why, Where it binds, Relations — rather than copying the wiki entry, whose numbering is unrelated and whose audience is the maintainer mid-task.

## Package READMEs

Each package's `README.md` is Korean and practical: what it is, why it exists, the domain folders or public surface, and the conventions a contributor needs. Point to `.wiki/` for the deeper design rather than restating it.

## Code JSDoc

Source JSDoc is English, in the interia voice: state what the type or function is and the non-obvious *why* (the design intent, the constraint it carries), not a paraphrase of the signature. Close interface types with `@author Samchon`. Examples in JSDoc are direction, not contract.

## Agent instructions

`AGENTS.md` and `SKILL.md` files are operational documents for humans and agents. Keep the repository-wide contract in `AGENTS.md`, the always-applicable procedure in `SKILL.md`, and conditional detail in a linked sibling document. A revision should read as if the rule had always been written there.

- **Optimize for comprehension, not minimum length.** A shorter document that forces the reader to infer prerequisites, reasons, exceptions, or stop conditions is not concise. Include the context needed to execute correctly.
- **Remove repetition, not substance.** State a rule once at its owning document and link to it elsewhere. Keep the rationale when it prevents a plausible mistake.
- **Give each paragraph one job.** Split purpose, rule, rationale, procedure, and consequence when combining them would make the reader unpack a dense block.
- **Use structure as compression.** Numbered lists for ordered procedures, bullets for choices or checklists, tables for repeated mappings, code blocks for exact commands. Do not hide a workflow inside one long sentence.
- **State the rule before its reason.** Use negative phrasing only for a named failure mode that the affirmative rule does not already exclude.
- **Skills point, not paraphrase.** Do not restate what the `.wiki/`, READMEs, or source comments already say; link to them. Skills carry cross-cutting rules and conventions, not a second copy of project docs.

## Prose line breaks

Write each Markdown paragraph on one source line. Never hard-wrap a single paragraph at a fixed column: Markdown already soft-wraps it, while manual wrapping makes small edits reflow unrelated lines.

One source line does not mean one long paragraph. Insert a blank line whenever the idea changes. Keep structural line breaks for paragraphs, list items, headings, tables, and fenced code.

## Voice

Plain and direct. State the fact and stop.

- No emoji.
- No filler adjectives: "powerful", "seamless", "robust", "effortless".
- No AI-cliche phrasing: "not only X but also Y", "whether you're X or Y", "it's worth noting", "let's dive in", and reflexive hedging.
- No wrap-up sentence that just restates the paragraph.
