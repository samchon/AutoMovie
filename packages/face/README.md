# `@automovie/face`

Deterministic parametric face, head, hair, and fitting geometry. The package is
headless and does not depend on Three.js.

The face/head morph surface is a preserved dormant boundary rather than part of
the current motion-first production path. Its topology, morph math, shell
builders, fitting utilities, and tests remain intact so a future face editor can
revive them without reclaiming the `forge` package name. Existing `IForge*`
symbol names are retained for source compatibility inside this newly explicit
package boundary.

## Preserved public compatibility callables

These callables remain public so direct geometry and fitting consumers can use
the dormant face boundary without constructing an editor runtime.

| Callable | Direct consumer purpose |
|---|---|
| `morphHead` | Applies a head morph to the preserved parametric topology. |
| `fitProfileAmplitude` | Fits one measured profile amplitude to its target samples. |
| `trackSilhouetteBands` | Tracks ordered silhouette bands across a fitted profile. |
| `cleanSilhouetteBands` | Removes invalid or duplicate silhouette band samples. |
| `fitSimilarity2` | Fits the deterministic 2D similarity transform used by profile fitting. |
| `taubinSmooth` | Smooths a mesh without the shrinkage of a single Laplacian pass. |
| `meshAdjacency` | Builds the adjacency graph consumed by the fitting and smoothing utilities. |

`packages/interface/src/face` remains in `@automovie/interface` because those
types are public cross-package value contracts consumed by ingest and engine
code. `packages/engine/src/face` remains in `@automovie/engine` because flatten
and morph operations execute those contracts. Expression and ARKit types also
stay in their current active expression system. Only the misleading package
identity moved; `@automovie/forge` is now free for the stand-in rig and prop
archetype stage owned by the object-model work.
