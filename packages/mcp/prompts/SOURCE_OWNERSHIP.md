# Source Ownership

The coding agent owns `src`, `docs`, `test`, and declared assets. AutoMovie owns tracked design and review records under `.automovie`. The compiler alone owns `generated`. Render commands own content-addressed `renders`.

Never patch `generated` to fix a source problem. Its manifest records every compiler-owned path and digest; unowned or modified output blocks compilation. Edit the owning source or design, then run `compileProject`.

Shot source executes in a deterministic boundary. Wall clock, random APIs, process, network, filesystem, timers, dynamic import, and runtime import are unavailable in the foundation compiler. Use explicit design seeds and injected geometry helpers. Type-only imports are documentation and disappear before execution.

The dense motion returned by a build is derived output. Its source of truth is the tracked source plus bounded design and compiler protocol. Fresh reopen must regenerate identical fingerprints and bytes.
