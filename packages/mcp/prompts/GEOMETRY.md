# Geometry

The engine geometry API has two halves: an oracle that measures the current compiled production, and constructors that build meshes your source owns. Both are ordinary package calls, never MCP tools.

## Measuring the compiled production

The non-MCP engine geometry API measures the current compiled production. It does not accept a caller-supplied film graph.

Use `distance` for point, actor, and landmark separation; `reach` for a compact current actor-to-target measurement; `pose` for a sampled actor root and joint inventory; `ground` for named world surface height and walkability; `formation` for derived count, bounds, motion, culling, and LOD; `effect` for fixed-step activity, live-particle cap, density, camera-ray intersection, contained subjects, and visibility risk; and `camera` to project animated subject roots through the current camera, FOV, clip planes, and production aspect ratio.

The camera query reports the shot contract's `maxAllowedOcclusionRatio` beside `occlusionMeasured: false`; it does not pretend that root-point projection measures pixel occlusion or full-body framing. Judge those from current beauty, mask, depth, outline, or pose PNG evidence through the review tools.

Compile source before querying. Load and narrow current state with `loadAutoMovieProjectState` and `requireCurrentAutoMovieProjectState` from `@automovie/cli`, then select ids from its authenticated registry; do not guess. Treat a diagnostic as a failed measurement, not a numeric zero. The reader performs Node I/O and must stay outside shot and film build functions.

The geometry oracle is intentionally compact. Source code remains the right place for loops, trajectory construction, choreography, and tests. Call the package API for facts the deterministic engine or current project knows better than prose.

## Code-authored meshes

The same package builds geometry, not only measures it. A shot program may return `models`: complete model records whose parts carry meshes your own source constructed. That is the path for a building, a moulding, a balustrade, a machine housing, or any shape no registered archetype makes, and it does not go through a model recipe. A recipe is a bounded parameter map validated against an archetype catalogue; this is a program, and the two are not substitutes.

Five constructors cover the convex constructive vocabulary, and each returns one mesh.

- `extrudeAutoMovieProfile({ profile, depth })` gives a prism from a planar profile: a plinth, a mullion, a slab, a sign.
- `revolveAutoMovieProfile({ profile, segments })` turns a profile about the vertical axis: a column, a baluster, a bowl, a dome. Every profile radius must be at or above zero, because a negative radius is a profile that crossed its own axis.
- `sweepAutoMovieProfile({ profile, path })` runs a profile along a polyline: a handrail, a cornice, a duct, a cable tray.
- `buildAutoMovieWall({ width, height, depth, openings })` gives a rectangular panel with rectangular voids cut in its local XY face. That is the wall-with-a-window case written once, instead of five boxes that have to keep agreeing about where the hole is.
- `buildAutoMoviePolyhedron(faces)` takes explicit planar faces, for a shape stated by its corners rather than by a profile.

Extrusion and sweep reduce their profile to its convex hull first, so an outline that crosses itself is resolved deterministically rather than trusted; author the profile you mean, and do not rely on winding order to carve a notch. Revolve does not, because a meridian is a silhouette rather than a section: it is taken exactly as authored and only its radii are checked. Closure there is yours to declare. A meridian that starts and ends on the axis closes into a solid whose pole rings collapse to zero-area triangles, one that does not is an open tube with a rim at each end, neither is repaired, and no UV atlas is generated.

Three more constructors exist for the shapes a hull destroys. `triangulateAutoMovieRegion` ear-clips an arbitrary ring less its holes; `extrudeAutoMovieRegion` turns that region into a closed prism, which is also the arbitrary-shape host opening `buildAutoMovieWall` cannot cut; `loftAutoMovieSections` blends authored sections along a path, so a taper, a changing section, and a hollow sweep are one operation. Nothing there is approximated: a ring under three points, a non-finite coordinate, a point repeated beside itself, a spike doubling back, a ring of no area, a ring crossing itself, two rings that touch, and a hole outside the region each raise their own diagnostic. All three are on the shot sandbox's importable surface, so a `build` function calls them the same way it calls the convex constructors.

Compose with `transformAutoMovieMesh(mesh, { translation, rotation, scale })` and `mergeAutoMovieMeshes([...])` when the result is one drawable, or `mergeAutoMovieMeshParts([{ id, mesh, transform }])` when you need the merged mesh plus the index range each named member occupies, which is how a part stays addressable after the merge. Every one of them refuses a skinned mesh: this is rigid construction, and a deforming surface belongs to a skeleton and an archetype instead. A placement takes the full transform, normals take the inverse transpose so a non-uniform scale does not tilt them off the surface, a mirroring scale flips triangle winding so the outward face stays outward, and no axis may be collapsed to zero.

Measure what you built before you ship it. `inspectAutoMovieMeshTopology(mesh)` reports triangle count, degenerate triangles, non-finite components, open boundary edges, non-manifold edges, whether the surface is watertight, and the signed volume, which is exact for a closed polyhedron. A shell that is not watertight is a shell light and camera get inside; a volume that comes back negative is a face wound the wrong way; a non-finite component is arithmetic that went wrong upstream and will reach the renderer as nothing at all. Read those numbers rather than the render.

`tessellateSurface(surface)` turns one declared support surface into triangles through the engine's own height rule, evaluating a heightfield at every lattice cut inside the footprint. Use it so what is drawn and what feet stand on are one bilinear evaluation instead of two that drift.

```ts
import {
  buildAutoMovieWall,
  inspectAutoMovieMeshTopology,
  mergeAutoMovieMeshes,
  transformAutoMovieMesh,
} from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";

/** One rectangular storey shell, written as a loop over its four sides. */
export const storeyShell = (props: {
  side: number;
  height: number;
  thickness: number;
}): IAutoMovieMesh => {
  const panel = buildAutoMovieWall({
    width: props.side,
    height: props.height,
    depth: props.thickness,
    openings: [
      { id: "window", x: props.side / 2 - 0.6, y: 1, width: 1.2, height: 1.4 },
    ],
  });
  const shell = mergeAutoMovieMeshes(
    [0, 1, 2, 3].map((side) => {
      const yaw = side * (Math.PI / 2);
      return transformAutoMovieMesh(panel, {
        translation: {
          x: Math.sin(yaw) * (props.side / 2),
          y: props.height / 2,
          z: Math.cos(yaw) * (props.side / 2),
        },
        rotation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
      });
    }),
  );
  const topology = inspectAutoMovieMeshTopology(shell);
  if (topology.nonFinite !== 0)
    throw new Error("storey shell produced non-finite geometry");
  return shell;
};
```

The loop is the point. A second storey is one more call with a different height, not a second copy of the literals, and a shell whose four sides disagree is a shell that was transcribed rather than derived.
