# AutoMovie production contract

Write creative and implementation work in `docs`, `src`, `test`, and declared
assets. Do not translate normal code into giant MCP JSON calls.

Read `AUTOMOVIE_OVERALL`, then the exact guide required by a production tool.
Use MCP for bounded design, deterministic compile facts, geometry, actual PNG
preview, and evidence-bound review.

Run `pnpm capture:install` and `pnpm capture:doctor` after dependency changes or
before the first preview/render. Do not silently fall back to a machine browser;
system Chrome or Edge must be selected explicitly in `automovie.config.ts`.

Never edit `generated`; correct its owning source or design and compile. Never
mark visual review complete without opening current bundle frames. A design,
source, generated, or frame change makes dependent review stale by design.

Keep time in seconds, space in right-handed Y-up meters, and randomness in
explicit design seeds. Do not use wall clock, network, process, filesystem, or
unseeded randomness inside shot build functions.
