# Issue 1429: production edit and render tiers

The compiler-owned `film-timeline.json` is the production EDL. Proxy and final
plans reopen that same edit fingerprint, but tier identity, raster, frame
clock, chunk slots, state roots, and publication paths remain distinct.
Proxy sampling keeps exact film runtime by requiring its frame step to divide
the compiled timeline.

The scaffold capture host now retains one browser page per target and raster.
The first frame navigates and constructs the scene; later frames only invoke
the capture hook's seek and take a screenshot. Render output records opened
pages, navigations, seeks, and captures so throughput is measured rather than
assumed.

Production film playback loads the EDL plus its independently reopenable shot
artifacts. Beauty dissolves use the viewer package's reusable GPU render target.
Structural passes select the dominant layer, with incoming winning a tie,
because interpolation invents invalid depth, normal, pose, mask, and outline
values. The offline renderer uses the same rule. Isolated model viewing is a
separate route with query-owned azimuth and elevation.

Guide deliverables publish their authenticated frame sequence beside the MP4.
GC is mark-and-sweep: current proxy/final chunk digests, stored review bundles,
and current aggregate publication paths are marked; unreferenced chunks,
quarantine entries, and publication files are candidates. Locks and attempts
never enter the inventory.
The CLI defaults to dry-run and deletes only the exact classified paths when
`--apply` is explicit.
