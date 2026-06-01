# Documentation

## The `.wiki/` knowledge base

`.wiki/` (gitignored) is motica's durable, cross-session knowledge base, written in Korean. It is the first thing to read at session start and must be revised as the work proceeds, not at the end. Layout: `00-governance` (operating manual, reading ledger), `01-progress` (current state, next priorities), `02-overview` (product), `03-philosophy` (the two harness articles + principles), `04-domain-research` (external study), `05-references` (agentica/autobe/interia), `06-architecture` (monorepo + per-package design), `07-decisions` (append-only decision log), `99-worklog` (dated logs).

- Record a design choice in `07-decisions/` (append-only; a later entry supersedes an earlier one) the moment it is made.
- Update `01-progress/README.md` whenever a package or capability lands.
- Keep `06-architecture/` matching the code; when generalizing the rig/engine model, the design doc precedes or accompanies the code.
- Separate confirmed fact (with file paths) from inference, and cite external sources by URL. References and domain study are evidence, not authority; do not transplant them verbatim.

## Package READMEs

Each package's `README.md` is Korean and practical: what it is, why it exists, the domain folders or public surface, and the conventions a contributor needs. Point to `.wiki/` for the deeper design rather than restating it.

## Code JSDoc

Source JSDoc is English, in the interia voice: state what the type or function is and the non-obvious *why* (the design intent, the constraint it carries), not a paraphrase of the signature. Close interface types with `@author Samchon`. Examples in JSDoc are direction, not contract.

## Voice

Plain and direct. State the fact and stop; no wrap-up sentence that restates the paragraph, no filler adjectives ("powerful", "seamless"), no AI-cliche phrasing. In Markdown prose write one line per paragraph and let it soft-wrap; keep real line breaks only for paragraph boundaries, lists, headings, tables, and code fences.
