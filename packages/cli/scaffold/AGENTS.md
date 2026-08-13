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

Write treatment and screenplay prose in `docs/{{name}}`. Keep exact treatment
beats, `SCN-*` headings, catalogs, continuity claims, and downstream
`{ reason, scene, claim? }` evidence synchronized with the screenplay index.
Activate its soft lock before the first shot; after lock preserve deleted
numbers as `OMITTED` and use alpha insertion ids instead of renumbering.

Register every distributable asset in `.automovie/assets.json` before use.
Preserve its source, license, original/current digest, processing chain, and
reasoned consumer; external models also declare ingest, LOD, collision, and
measurement-proxy decisions. Never invent provenance or license terms.

Keep time in seconds, space in right-handed Y-up meters, and randomness in
explicit design seeds. Do not use wall clock, network, process, filesystem, or
unseeded randomness inside shot build functions. The project-state reader is a
filesystem API and is forbidden inside shot or film build functions; use it
only from standalone measurement scripts, tests, and offline diagnostics.
