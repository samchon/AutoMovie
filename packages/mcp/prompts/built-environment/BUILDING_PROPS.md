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

Resting is not standing. `builtEnvironmentSupportStatus` answers whether a body meets its support; it does not answer whether the body stays there once it does. `detectSupportToppling` takes the object's centre of mass and the contact points it stands on, projects the centre onto the ground plane, and warns when it overhangs the convex hull of those contacts past `margin`, returning the pivot edge and the direction it falls. `detectFreeFall` asks the same question of a body held up by nothing: given a declared physical body, its support contacts, and whether it is attached or already falling, it warns and offers the fall arc. A shelf bracket that rests on its wall and a vase resting on two centimetres of a table edge both pass the support query, and only these two separate them.

State the contacts yourself. Neither derives them from the building, so the top face a thing stands on is an authored input here, and a contact list that describes a face nobody modelled produces a confident answer about nothing. Both are advisory: their findings ride `warnings` on a validation whose `success` is `true`, which `MOTION` states in full for the motion side of the same tier, and a deliberately levitating prop sets `physicsIntent` to say so.

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import {
  builtEnvironmentPlacementBounds,
  detectSupportToppling,
} from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
const environment = state.generated.shots.get("kitchen")?.builtEnvironments?.[0];
if (environment === undefined)
  throw new Error('shot "kitchen" compiles no built environment');
const table = builtEnvironmentPlacementBounds({
  environment,
  target: { kind: "element", id: "counter" },
});
if (table === null || table.basis === "element-origin-point")
  throw new Error("the counter resolved to no measured volume to stand on");
const result = detectSupportToppling({
  node: "kettle",
  // The prop's own centre of mass, in the same world frame as the contacts.
  centerOfMass: { x: 1.2, y: 0.94, z: 0.4 },
  support: [
    { x: table.min.x, y: table.max.y, z: table.min.z },
    { x: table.max.x, y: table.max.y, z: table.min.z },
    { x: table.max.x, y: table.max.y, z: table.max.z },
    { x: table.min.x, y: table.max.y, z: table.max.z },
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
