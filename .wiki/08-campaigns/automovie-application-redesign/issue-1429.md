# Issue 1429: production edit and render tiers

The compiler-owned `film-timeline.json` is the production EDL. Proxy and final
plans reopen that same edit fingerprint, but tier identity, raster, frame
clock, chunk slots, state roots, and publication paths remain distinct.
Proxy sampling keeps exact film runtime by requiring its frame step to divide
the compiled timeline.

The scaffold capture host now retains one browser page per production, compile,
target, and raster (asset azimuth remains seek-driven inside that identity).
The first frame navigates and constructs the scene; later frames only invoke
the capture hook's seek and take a screenshot. Render output records opened
pages, navigations, seeks, captures, cumulative capture milliseconds, and
captures/second so throughput is measured rather than assumed. A new compile
closes the prior resident page before pixels can receive the new fingerprint.

Production film playback loads the EDL plus its independently reopenable shot
artifacts. Beauty dissolves use the viewer package's reusable GPU render target.
Structural passes select the dominant layer, with incoming winning a tie,
because interpolation invents invalid depth, normal, pose, mask, and outline
values. The offline renderer uses the same rule. Isolated model viewing is a
separate route with query-owned azimuth and elevation.

Every guide deliverable owns one typed structural pass, so separate depth,
normal, mask, outline, and pose outputs can be planned by the real CLI rather
than a test-only planner argument. Guide deliverables publish their complete,
continuous authenticated frame sequence beside the MP4; final validation checks
every numbered full-raster control PNG.

Proxy and final publication addresses use a fingerprint over compile, EDL,
tier policy, capture/encoder runtime, chunk ids, and tracks. Final conform
requires an immutable proxy publication with the same compile and EDL
fingerprints, so a later edit cannot silently reuse an earlier review proxy.
GC is mark-and-sweep: current proxy/final chunk digests, stored review bundles,
and current aggregate publication paths are marked; unreferenced chunks,
quarantine entries, and publication files are candidates. Locks and attempts
never enter the inventory. Stale plan files do not mark data forever, while
`--apply` refuses live lock/attempt owners. The CLI defaults to dry-run and,
when apply is explicit, rechecks every physical ancestor and atomically moves
each exact candidate into an owned quarantine before removal.
