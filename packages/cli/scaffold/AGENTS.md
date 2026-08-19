# AutoMovie production contract

Write creative and implementation work in `docs`, `src`, `test`, and declared
assets. Do not translate normal code into giant MCP JSON calls.

`src/examples` is reading material, not a library. Each file demonstrates one
authoring technique against placeholder geometry, nothing in the production
imports it, and no evidence claim covers it. Copy the technique into your own
`src/units`, `src/objects`, `src/world`, or `src/formations`, then delete what
you have read. Never import from it, and never grow it into a catalogue of
finished parts: the models, finishes, and fittings a film needs are this
production's own to author.

Read `AUTOMOVIE_OVERALL`, then the exact guide required by a production tool.
Use MCP for actual PNG evidence and evidence-bound review. For offline geometry,
load current compiler-owned state through `loadAutoMovieProjectState`, require
its freshness to be current, and pass its typed values to pure engine functions.

Run `npm run capture:install` and `npm run capture:doctor` after dependency changes or
before the first preview/render. Do not silently fall back to a machine browser;
system Chrome or Edge must be selected explicitly in `automovie.config.ts`.

The tracked design records under `.automovie/design` are derived, not hand-kept.
`scripts/emitDesign.ts` builds each one from the typed source that owns it and
`npm run design` stores it, so that script is this production's code: it imports
your units, formations, world, and shots by path and states each shot's module
and export. Replace those sources and you edit that script in the same pass. It
writes and never deletes, so a record you stop deriving stays resident and keeps
its obligations. `npm run design` refuses while one is there and names its file,
because nothing downstream can: a resident record that references only other
resident records compiles clean and is built into your `generated` output.
Delete the file it names, or derive it. The screenplay index is not a design
record and is never named. Read `PRODUCTION_DESIGN` before replacing the starter
film, which is one pass and cannot be closed green halfway.

Never edit `generated`; correct its owning source or design and compile. Never
mark visual review complete without opening current bundle frames. A design,
source, generated, or frame change makes dependent review stale by design.

Open `viewer/inspect.html?shot=<id>` to fly a free camera through a compiled
shot when the authored framing is what hides a fault; it prints the eye's
position so an oddity is reported by coordinate. It writes nothing and is not a
delivery path, so it never substitutes for review evidence. Open
`viewer/subject.html?shot=<id>&subject=<kind>:<id>` to look at one thing alone
instead; without `?subject=` it lists the shot's spaces and instance sets. Its
eye is derived from the subject's content extent rather than its declared cell,
and `X` sections the near side, without which an opened room shows only its
outer wall. It writes nothing and is not a delivery path either. Read
`DEBUGGING`.
The project write hook also protects `renders`, capture receipts, and
`.automovie/productions`; use the command named by its refusal.

Write prose as a ladder of one document per unit, downward and in order:
`docs/settings` states what exists and how large it is, `docs/storylines`
states what happens, `docs/scenarios` stages one storyline as one physical
action, and `docs/script` is the final script the shots realize. Every document
cites the rung above it and `docs/principles`, in one HTML comment before its
H1. There is no shortcut from a setting to a scene: `lint.config.ts` refuses a
storyline no scenario stages and a scenario no script scene realizes, each by
name. Read `EVIDENCE_GRAPH` before adding a rung.

A production that authors only subjects leaves `docs/storylines`,
`docs/scenarios` and `docs/script` empty, and those rungs go silent together
while `docs/settings` and `src` stay bound. Do not delete the empty folders and
do not edit `lint.config.ts` to reach that state.

Keep exact beat text, `SCN-*` headings, catalogs, continuity claims, and
downstream `{ reason, scene, claim? }` evidence synchronized with the
screenplay index. Activate its soft lock before the first shot; after lock
preserve deleted numbers as `OMITTED` and use alpha insertion ids instead of
renumbering.

Register every distributable asset in `.automovie/assets.json` before use.
Preserve its source, license, original/current digest, processing chain, and
reasoned consumer; external models also declare ingest, LOD, collision, and
measurement-proxy decisions. Never invent provenance or license terms.

Keep time in seconds, space in right-handed Y-up meters, and randomness in
explicit design seeds. Do not use wall clock, network, process, filesystem, or
unseeded randomness inside shot build functions. The project-state reader is a
filesystem API and is forbidden inside shot or film build functions; use it
only from standalone measurement scripts, tests, and offline diagnostics.
