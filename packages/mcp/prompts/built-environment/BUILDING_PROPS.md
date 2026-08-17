# Props In A Building

Placing a thing inside a work and proving it stands where you meant. Read this before putting furniture, fittings, stock, or any set piece into a room.

The rooms themselves are `BUILT_ENVIRONMENT`, the prop's own rig is `OBJECT_RIGGING`, and its recipe is `MODEL_RECIPE`.

## Props in a building

Placement support is an authored relation, not a guess from proximity. The subject is an element or a compact population; the support is either of those or an authored `surface`, which is evaluated through its own height rule rather than through a box. Declare `bearing` or `suspended`, then ask `builtEnvironmentSupportStatus(`. It answers `resting`, `floating`, `sunk`, `not-over-support` when nothing of the subject stands over the support at all, `suspended` for a declared hang, and `unresolved` naming which side failed to resolve. A bearing that lands over its support carries the signed underside `gap` in metres, so "floating" comes with how far; every other answer leaves `gap` null. Omitting `tolerance` uses the engine's own placement epsilon; a negative or non-finite one is refused rather than defaulted, because it withdraws the meaning of contact instead of adjusting it.

Read the `basis` before you believe the number. `element-geometry-bounds` measured the vertices the renderer draws and `surface-height-rule` evaluated an authored patch exactly, but `population-placement-bounds` is a conservative envelope over a whole field and `element-origin-point` measured no extent at all: the record states where that body stands and carries no vertices for it, as with a runtime model reference, so a `separate` or `floating` verdict taken from it is a claim about a point. `builtEnvironmentPlacementBounds(` resolves one element or population locator to that same box and basis, and `builtEnvironmentPlacementOverlap(` compares two named placements and reports each side's basis with the verdict. Populations keep their conservative prototype basis throughout and are never expanded into thousands of members. Keep unresolved identities and overlap findings explicit instead of inferring a support from labels or storing a second world box.

Run the check over the things you placed rather than over one you doubt, because it is cheap and a wrong answer is silent:

```ts
import { builtEnvironmentSupportStatus } from "@automovie/engine";
import type {
  AutoMovieBuiltPlacementBodyLocator,
  AutoMovieBuiltPlacementSupportLocator,
  IAutoMovieBuiltEnvironment,
} from "@automovie/interface";

/** One authored claim that a named body bears on a named support. */
export interface IBearingClaim {
  subject: AutoMovieBuiltPlacementBodyLocator;
  support: AutoMovieBuiltPlacementSupportLocator;
}

export const unsupportedBodies = (
  environment: IAutoMovieBuiltEnvironment,
  claims: readonly IBearingClaim[],
): string[] =>
  claims.flatMap((claim) => {
    const result = builtEnvironmentSupportStatus({
      environment,
      query: { ...claim, kind: "bearing" },
    });
    return result.status === "resting"
      ? []
      : [
          [
            claim.subject.kind,
            claim.subject.id,
            "on",
            claim.support.kind,
            claim.support.id,
            result.status,
            "gap",
            String(result.gap),
            "basis",
            String(result.subjectBasis),
          ].join(" "),
        ];
  });
```

Asking about a pair you doubt is not the same as asking about the building. `builtEnvironmentSupportSweep` and `builtEnvironmentPlacementOverlapSweep` take the environment and nothing else: the first reports every body with clear air under it, the nearest measurable body below each one and the clearance to it, beside counts of what stood on the ground, what stood on something, and what could not be measured at all; the second reports every pair whose volumes intersect, graded by the share of the smaller body inside the larger and deepest first. Exact face contact is not intersection, so a slab bearing on a wall head and a tenon in its mortise produce nothing, and what remains is interpenetration. Neither claims a support relation. The first says what is under a body, which is a measurement; the declared relation stays yours to state and `builtEnvironmentSupportStatus` stays the way to judge it.

Read the census before the findings. Both answers carry what they measured and what they cost, and an empty finding list from a sweep that resolved nothing reads exactly like a clean building. A body the record locates but carries no vertices for is judged as the point it states, so an `element-origin-point` basis on a floating finding is a claim about a point rather than about a member hanging in the air.

The sweeps run in a project script under `scripts/`, where the whole engine is available, because they read a compiled building rather than help build one.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import {
  builtEnvironmentPlacementOverlapSweep,
  builtEnvironmentSupportSweep,
} from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
for (const [shot, compiled] of state.generated.shots)
  for (const environment of compiled.builtEnvironments ?? []) {
    const support = builtEnvironmentSupportSweep({ environment, groundY: 0 });
    console.log(
      shot,
      environment.id,
      "measured",
      support.measured,
      "grounded",
      support.grounded,
      "borne",
      support.borne,
      "unresolved",
      support.unresolved.length,
    );
    for (const finding of support.floating)
      console.log(
        "  floating",
        finding.body.kind,
        finding.body.id,
        finding.basis,
        finding.below === null
          ? "nothing below"
          : finding.below.clearance.toFixed(3) + " m over " + finding.below.body.id,
      );
    const overlap = builtEnvironmentPlacementOverlapSweep({ environment });
    for (const pair of overlap.pairs)
      console.log(
        "  intersects",
        pair.left.id,
        pair.right.id,
        (pair.fraction * 100).toFixed(1) + "% of the smaller",
      );
  }
```

Resting is not standing. `builtEnvironmentSupportStatus` answers whether a body meets its support; it does not answer whether the body stays there once it does. `detectSupportToppling` takes the object's centre of mass and the contact points it stands on, projects the centre onto the ground plane, and warns when it overhangs the convex hull of those contacts past `margin`, returning the pivot edge and the direction it falls. `detectFreeFall` asks the same question of a body held up by nothing: given a declared physical body, its support contacts, and whether it is attached or already falling, it warns and offers the fall arc. A shelf bracket that rests on its wall and a vase resting on two centimetres of a table edge both pass the support query, and only these two separate them.

Derive their inputs rather than typing coordinates. `supportContactsFor` takes a space and an object's footprint and returns a contact at each surface a footprint point stands over, walkable or not, contributing none where it stands over nothing. `affordanceSupportContacts` does the same for one `stack-top` affordance of a prop, carrying its extent corners through the affordance frame and the parent's world transform. `bodyCenterOfMass` answers the centre: the body's declared `centerOfMass` when it states one, and the volume-weighted centroid of the model's own primitives when it does not, in that model's own frame and `null` for a model with no volume to weigh. Both checks consume exactly what those three produce.

Type a contact list only when you mean a face nobody modelled, and say why. A hand-written contact is a claim, and a claim about a face that does not exist buys a confident answer about nothing, which is the failure the derivation exists to remove.

Both checks are advisory: their findings ride `warnings` on a validation whose `success` is `true`, which `MOTION` states in full for the motion side of the same tier, and a deliberately levitating prop sets `physicsIntent` to say so.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import {
  Quaternion,
  Vector3,
  bodyCenterOfMass,
  builtEnvironmentPlacementBounds,
  detectSupportToppling,
  propAnchorFrame,
} from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
const compiled = state.generated.shots.get("kitchen");
const environment = compiled?.builtEnvironments?.[0];
const kettle = state.generated.models.get("kettle");
if (compiled === undefined || environment === undefined || kettle === undefined)
  throw new Error('shot "kitchen" compiles no kettle standing in a building');
const counter = builtEnvironmentPlacementBounds({
  environment,
  target: { kind: "element", id: "counter" },
});
if (counter === null || counter.basis === "element-origin-point")
  throw new Error("the counter resolved to no measured volume to stand on");
// The centre comes from the model, not from a number typed here: a declared
// centre of mass wins over the geometric one, and only the model knows which it
// has. It arrives in the model's own frame, so it is carried into the world
// through the frame the prop's own relation resolves to; adding it to a bounds
// corner would be right only for a prop nobody rotated.
const centre = bodyCenterOfMass(kettle);
// A building surface resolves from the environment alone. A prop affordance
// would need the current prop registry and the staged set as well, which the
// relation section above says.
const stand = propAnchorFrame({
  target: {
    kind: "surface",
    environment: environment.id,
    surface: "counter-top",
  },
  environments: [environment],
});
if (centre === null)
  throw new Error("the kettle model carries no geometry to weigh");
if (stand === null) throw new Error("the counter top resolved to no frame");
const result = detectSupportToppling({
  node: "kettle",
  centerOfMass: Vector3.add(
    stand.translation,
    Quaternion.rotateVector(stand.rotation, centre),
  ),
  support: [
    { x: counter.min.x, y: counter.max.y, z: counter.min.z },
    { x: counter.max.x, y: counter.max.y, z: counter.min.z },
    { x: counter.max.x, y: counter.max.y, z: counter.max.z },
    { x: counter.min.x, y: counter.max.y, z: counter.max.z },
  ],
});
if (result.toppling !== null)
  console.log("overhangs by", result.toppling.overshoot, "metres");
```

A prop is a crude primitive proxy with rich meaning. The geometry stays simple boxes and cylinders while the physics body, the contact affordances, and a self-declared articulation carry what the engine validates. Articulation is the object-side counterpart of a character's skeleton and range of motion: the prop's own joint nodes, a profile whose limits bound them and whose drivers couple them (a handle that mirrors a hinge), and the binding that maps profile keys onto those nodes. A rigid prop leaves the whole articulation `null`.

A prop may cite `modelRef` when the drawn appearance is imported bytes, and that hatch buys the appearance alone. `origin` becomes `imported`, the sealed closure must be a rigid `gltf-static-v1` appearance mapping no humanoid bones and carrying well-formed digests over paths its own ledger covers, and the authored parts stay the deterministic proxy every geometric judgment is made against, which is how an imported chair keeps a seat face other props can be proven to rest on. A humanoid appearance is a performer and goes to the cast instead. Whether the reference resolves to a registration, and whether each digest matches bytes on disk, is the compiler's question, not the record's.

Placement is where a prop meets the building, and it cites ids rather than copying geometry. The typed relations are `in-space`, `on-support`, `against-boundary`, `fill-opening`, `attached`, and `suspended`, each accepting only the target kinds it can mean. At most one `in-space` and one `fill-opening` may be declared, because a prop occupies one logical space and fills one passage; the rest may repeat, so a cabinet may stand against two walls and a rail may socket into three posts. Authored order never changes the outcome, and a relation may cite a prop declared later.

Shot source may call `propAnchorFrame({ target: relation.target, environments, props, set })` to derive the prop's exact world position and rotation. Pass the current prop registry and staged set when the target is a prop affordance; `null` means the named target did not resolve. Keep that call in source so the same relation drives placement and validation; do not copy the returned frame into a second authored transform.

State a `footprint` when the volume that matters is not the volume you modelled: a chair needs the room its seat sweeps back into, and a decorative overhang that is nobody's obstacle should be trimmed out. Leave it `null` to derive the exact bound of the prop's own parts, which is the honest default. `clearance` boxes are the keep-out volumes a door leaf, a drawer, a service panel, or a person using the thing needs, and they are checked against other props and against the passages the building declares, so a wardrobe that blocks a doorway or a bench that blocks a stair is a refusal rather than something a reviewer has to notice in a frame.

## Look at the placement

The support and overlap queries answer whether a prop rests and whether two things occupy one volume. They do not answer whether the room reads as furnished or as a warehouse of correctly grounded boxes.

1. `inspectSubject({ shot, subject })` on the room, which sections automatically, so the arrangement is seen from inside rather than through its own wall.
2. `captureTurntable({ asset })` on the prop's own model, because a defect in one recipe is repeated by every placement that uses it.
3. `prepareReview` and `submitReview` under `REVIEW_SUBJECT` for the room or the prop, and `REVIEW_ASSET` for the model recipe.
