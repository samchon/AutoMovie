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

The convex constructive vocabulary is the constructors below, and each returns one mesh.

- `extrudeAutoMovieProfile({ profile, depth })` gives a prism from a planar profile: a plinth, a mullion, a slab, a sign.
- `revolveAutoMovieProfile({ profile, segments })` turns a profile about the vertical axis: a column, a baluster, a bowl, a dome. Every profile radius must be at or above zero, because a negative radius is a profile that crossed its own axis. Its atlas shears once the meridian leaves the axis, so a form that both slopes and carries a directional finish is built as facets instead; the texture section states how far that goes.
- `sweepAutoMovieProfile({ profile, path })` runs a profile along a polyline: a handrail, a cornice, a duct, a cable tray.
- `buildAutoMovieWall({ width, height, depth, openings })` gives a rectangular panel with rectangular voids cut in its local XY face. That is the wall-with-a-window case written once, instead of five boxes that have to keep agreeing about where the hole is.
- `buildAutoMoviePolyhedron(faces)` takes explicit planar faces, for a shape stated by its corners rather than by a profile.

Extrusion and sweep reduce their profile to its convex hull first, so an outline that crosses itself is resolved deterministically rather than trusted; author the profile you mean, and do not rely on winding order to carve a notch. Revolve does not, because a meridian is a silhouette rather than a section: it is taken exactly as authored and only its radii are checked. Closure there is yours to declare. A meridian that starts and ends on the axis closes into a solid whose pole rings collapse to zero-area triangles, one that does not is an open tube with a rim at each end, and neither is repaired.

More constructors exist for the shapes a hull destroys. `triangulateAutoMovieRegion` ear-clips an arbitrary ring less its holes; `extrudeAutoMovieRegion` turns that region into a closed prism, which is also the arbitrary-shape host opening `buildAutoMovieWall` cannot cut; `loftAutoMovieSections` blends authored sections along a path, so a taper, a changing section, and a hollow sweep are one operation. Nothing there is approximated: a ring under three points, a non-finite coordinate, a point repeated beside itself, a spike doubling back, a ring of no area, a ring crossing itself, two rings that touch, and a hole outside the region each raise their own diagnostic. Each of them is on the shot sandbox's importable surface, so a `build` function calls them the same way it calls the convex constructors.

Compose with `transformAutoMovieMesh(mesh, { translation, rotation, scale })` and `mergeAutoMovieMeshes([...])` when the result is one drawable, or `mergeAutoMovieMeshParts([{ id, mesh, transform }])` when you need the merged mesh plus the index range each named member occupies, which is how a part stays addressable after the merge. Every one of them refuses a skinned mesh: this is rigid construction, and a deforming surface belongs to a skeleton and an archetype instead. A placement takes the full transform, normals take the inverse transpose so a non-uniform scale does not tilt them off the surface, a mirroring scale flips triangle winding so the outward face stays outward, and no axis may be collapsed to zero.

Measure what you built before you ship it. `inspectAutoMovieMeshTopology(mesh)` reports triangle count, degenerate triangles, non-finite components, open boundary edges, non-manifold edges, whether the surface is watertight, and the signed volume, which is exact for a closed polyhedron. A shell that is not watertight is a shell light and camera get inside; a volume that comes back negative is a face wound the wrong way; a non-finite component is arithmetic that went wrong upstream and will reach the renderer as nothing at all. Read those numbers rather than the render.

`tessellateSurface(surface)` turns one declared support surface into triangles through the engine's own height rule, evaluating a heightfield at every lattice cut inside the footprint, and drawing a concave footprint's notch and a holed one's void open rather than filled. Use it so what is drawn and what feet stand on are one bilinear evaluation instead of two that drift. It hands back positions, normals, and indices rather than a mesh record, and `null` when the footprint yields no drawable piece, so wrap the result yourself and answer the empty case rather than passing it straight on. It emits no texture coordinates, which the texture section below picks up.

```ts
import {
  extrudeAutoMovieRegion,
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
  // Every corner is derived from the storey it belongs to, so the opening stays
  // strictly inside the panel at any size the caller asks for.
  const halfSide = props.side / 2;
  const halfHeight = props.height / 2;
  const opening = { halfWidth: props.side / 8, halfHeight: props.height / 6 };
  const panel = extrudeAutoMovieRegion({
    outer: [
      { x: -halfSide, y: -halfHeight },
      { x: halfSide, y: -halfHeight },
      { x: halfSide, y: halfHeight },
      { x: -halfSide, y: halfHeight },
    ],
    holes: [
      [
        { x: -opening.halfWidth, y: -opening.halfHeight },
        { x: opening.halfWidth, y: -opening.halfHeight },
        { x: opening.halfWidth, y: opening.halfHeight },
        { x: -opening.halfWidth, y: opening.halfHeight },
      ],
    ],
    depth: props.thickness,
  });
  const shell = mergeAutoMovieMeshes(
    [0, 1, 2, 3].map((side) => {
      const yaw = side * (Math.PI / 2);
      return transformAutoMovieMesh(panel, {
        translation: {
          x: Math.sin(yaw) * halfSide,
          y: halfHeight,
          z: Math.cos(yaw) * halfSide,
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

The constructor choice is the second point. `buildAutoMovieWall` states this panel more directly, with the opening as a rectangle rather than as a ring, and it emits no texture coordinates, so the merged shell could carry nothing but a flat color. The region extrusion states the same panel as an outline and a void, cuts an outline no rectangle describes, and lays a metric atlas over the result, so the shell that comes back can carry a finish. Reach for it whenever the member is going to be surfaced.

## Texture coordinates

An atlas-bearing procedural mesh measures its texture coordinates in local metres of surface distance, never in a `[0, 1]` box. One unit is one metre before any later `transformAutoMovieMesh` placement, which deliberately carries the coordinates along rather than re-cutting them.

A 2 m face therefore spans two units, and the repeat a finish wants is `1 / tile`, where `tile` is the metres one turn of the image covers. That number does not depend on how large the face is. Dividing the face extent by the module size is the arithmetic for a normalized surface, and it is wrong here.

Say so at the binding. `coordinateSource: "surface-metres"` is what an atlas-bearing procedural surface emits, and `"normalized"` is what a lattice surface and a pattern module prototype carry instead. Use `"source-uv"` when an ingested mesh keeps an arbitrary authored layout: neither real scale nor a `[0, 1]` extent can be inferred from that label, so its source layout or adoption receipt must supply the transform. Omitting `coordinateSource` preserves legacy raw sampling but makes no new claim about what one unit means.

Every constructor that emits coordinates measures them in metres, so one declared scale reads the same on all of them. What differs is how the metres are taken.

`buildAutoMoviePolyhedron` projects. Each face takes an in-plane frame its own normal decides: world up projected into the plane as V wherever the face is not level, and world +X as U where it is. That is what carries coursing around an upright wall return, a column wrap, and a countertop edge, because V is the same function of height on both sides of the corner.

U does not continue around that upright fold, and that break is the stated behaviour rather than an accident. A level-to-upright fold can share phase on its edge while each side advances in its own stated orientation. A face within about 0.081 degrees of level uses the level frame, and crossing that boundary is an orientation seam rather than a continuity claim between two nearly level faces.

`extrudeAutoMovieRegion`, `loftAutoMovieSections`, and `revolveAutoMovieProfile` develop instead: distance travelled around the section against distance travelled along the path, which is the only local metric answer on a surface that curves, plus the section's own coordinates on a cap.

Every developed ring has an explicit cut between zero and its full perimeter, and a revolution counts down across that cut rather than up, because its around-axis runs against the direction the lattice is built in. A repeating image has equal phase across the cut only when its declared repeat divides the perimeter, and a changing section shears between unequal perimeters because no flat atlas can preserve every distance on a generally non-developable surface.

Whichever constructor built it, every emitted triangle maps its corners the same way round, so a letter, a logo, or any directional finish reads the same on a wall, a moulding, and a turned baluster, and a `normalTexture` is sampled through one tangent handedness across a whole merged assembly. Do not pre-mirror an image to compensate for a builder; none of them mirrors.

Handedness is settled; how hard a developed atlas shears is not, and that is what decides which forms can carry a directional finish at all.

On a revolution the shear is invisible in the place an author looks first. That atlas is exactly equiareal, so it never thins the texels out: a slate on a spire keeps its area and its resolution the whole way up, and the frame shows no blur to explain what is wrong. What it loses is the angle between the two axes.

On a revolution the shear grows with how far the meridian leans off the axis and not at all with the radius, reaching about two to one by 6.5 degrees, four to one by 13.8 degrees, and past twenty to one on a 45-degree cone, where a course that reads square beside the seam is drawn into a ribbon a quarter turn away and a vertical joint spirals.

Do not read the pole as the culprit and try to trim it. Cut the tip off that cone and the frustum left behind, with no pole and no collapsed triangle anywhere, shears exactly as hard.

`revolveAutoMovieProfile` is therefore exact for a member whose meridian stays within a few degrees of the axis: a drum, a shaft, a turret barrel. The JSDoc on it carries the closed form and why the shear cannot be cancelled.

A loft's atlas is not equiareal, and that is the one place this section's "density is safe, only the angle moves" reading does not hold. Its `v` is distance along the path rather than along the surface, and the two differ whenever the member tapers or turns. A taper tilts each ruling off the path, so the leg carries the taper angle's cosine: a section growing 0.5 m over 4 m of path reads 0.9923, which is nothing. A bend is not nothing. At a point where the path's curvature radius is `R`, a piece of section sitting `d` away from the path travels `(R + d) / R` as far as the path does, so its texels are stretched by that much on the outside of the turn and crowded by the same law on the inside. It depends on `d / R` alone, so building the member bigger does not help: a section a quarter as wide as the bend radius spans 0.8 to 1.333 across itself, a 1.67 to 1 density range on one moulding. Run a cornice straight and mitre it at the corner if its finish has to hold density, and give a curved run a finish that does not report its own scale.

The way out is to stop revolving, not to reach for another developed builder. `loftAutoMovieSections` measures the same pair and a tapered loft shears the same way, so it is no escape here even though it is the escape for a sweep that emits nothing. Build a spire, a broach, or a faceted dome out of flat faces through `buildAutoMoviePolyhedron(`, whose per-face frame is a rigid motion of the face's own plane and therefore carries no shear at all, and take flat caps and panels from `extrudeAutoMovieRegion(`, which is rigid the same way. A faceted spire built that way draws upright courses and unbroken vertical joints to its apex. The grain's phase breaks at each arris, and that is how a real spire is slated rather than a defect. Where the form has to stay a true surface of revolution, keep the finish on it non-directional.

A face's coordinates are anchored on its own mesh origin, so the continuity above is a property of one call rather than of the world. Faces built in one `buildAutoMoviePolyhedron(` call measure from one origin, which is what lets the shared V read the same height on both sides of a corner; two members built separately and then placed do not share that datum, however exactly their placements abut, because each was measured from where it was built rather than from where it ended up. Build the faces that have to hold their courses together in one call. `transformAutoMovieMesh` then carries those coordinates through a placement untouched, so a panel built upright and laid flat afterwards presents a level face still measured in the upright frame it was cut in. That is what a real board does when it is turned. Build a member in the orientation it will be seen in unless travelling grain is what you want.

`extrudeAutoMovieProfile`, `sweepAutoMovieProfile`, `buildAutoMovieWall`, and `tessellateSurface` emit no coordinates at all.

The region extrusion replaces the profile extrusion and the wall, and a loft carrying the same section at `at` 0 and `at` 1 replaces the sweep. That the two sections are the same is what keeps the substitute rigid, because it is the change between them that shears a loft. Build a member that carries a finish with the replacement.

The support surface has no replacement, because its whole point is that the drawn ground is the queried ground. A level floor that has to carry a tile is a second drawable extruded from the same footprint, and a relieved one has no atlas-bearing equivalent at all, since a flat region does not follow its height rule.

`mergeAutoMovieMeshes` and `mergeAutoMovieMeshParts` keep coordinates only when every member has them, so one coordinate-less member silently costs the whole assembly its finish. That is deliberate: filling the gap with zeros would pin that member to one texel and read as flat paint.

Nothing recomputes a declared scale against the surface it landed on unless you ask.

`validateTextureScale` is the engine's answer to that question, and it needs both halves at once, so it reads model records rather than a material on its own. A binding that declares `"normalized"` against a set measuring more than one is refused, because a normalized set covers its surface exactly once and a 9 m span is the declaration contradicting the geometry it was bound to. A `"surface-metres"` binding whose implied `1 / scale` tile is larger than the surface's own span is warned about instead, because that same geometry is how one image is legitimately fitted to a single face, and a binding whose sampler clamps that axis has already said so.

Nothing in compilation runs it for you, and it is not on the shot sandbox's importable surface, so a project script under `scripts/` is what measures the models a build produced. Run `npm run texture:scale` after a build: it reports a census of what it examined beside its findings, because an empty finding list from a run that measured nothing is otherwise indistinguishable from a clean one.

There is no atlas and no second UV set, and that is a decided exclusion rather than pending work. Packing islands is a layout decision no authoring agent can state in prose, the layout only earns its keep once it leaves the engine as something an image model can paint into, and the product has no such export; painted-to-fit artwork is finished-look work the repaint lane owns rather than blocking-pass work. It reopens when an authoring agent can drive a packing rule and the layout has somewhere to go. Until then a texture you generate must be tileable at a real-world size or must fill one flat rectangle whose own extent you already know, and different artwork on different faces of one object is outside the engine.

## Look at the mesh you constructed

A constructor returning a mesh proves the call type-checked. Whether the shape is the shape you meant is a question only the picture answers.

1. `captureTurntable({ asset })` for a recipe-owned model, which commits the whole required view set in one call.
2. `captureFrame` with a `part` on the asset target for one constructed part: a profile that swept the wrong way and a revolve that closed on itself both read as correct in a whole-model view.
3. `inspectSubject({ shot, subject })` once the mesh is placed, because a solid is judged in the space it stands in and a named space is sectioned automatically.
4. `prepareReview` and `submitReview` under `REVIEW_ASSET` or `REVIEW_SUBJECT`, whichever owns the thing you built.
