import { placementChildNode } from "@automovie/engine";
import { IAutoMoviePropSpec, IAutoMovieScene } from "@automovie/interface";
import * as THREE from "three";

import { IAutoMovieModelObject, applyTransform } from "./buildModel";

/** One prop joint's rest placement, restored before every frame. */
interface IJointRest {
  object: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

/**
 * The articulation subtrees one scene's props contribute.
 *
 * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Limits this articulation surface to authored object-motion channels.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Materializes those channels at the attachment and interaction boundary.
 * @author Samchon
 */
export interface IAutoMovieBuiltPropArticulation {
  /**
   * Every lowered joint by its scene id (`<placement>/<joint>`), which is the
   * name a shot's `objectMotions` track addresses it by.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Limits this articulation surface to authored object-motion channels.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Materializes those channels at the attachment and interaction boundary.
   */
  joints: ReadonlyMap<string, THREE.Object3D>;

  /**
   * Put every joint back where its prop declares it stands.
   *
   * The same obligation a host already has for staged node transforms:
   * {@link applyObjectMotions} writes only the channels the clip carries and the
   * engine's own resolver falls back to rest instead, so a host that seeks
   * backwards past a clip's first key would otherwise keep whatever the last
   * draw left behind.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Limits this articulation surface to authored object-motion channels.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Materializes those channels at the attachment and interaction boundary.
   */
  restore: () => void;
}

/**
 * Build the moving parts of a shot's props into the scene a host assembled.
 *
 * A prop's articulation is data everywhere else in the pipeline: `forgeProp`
 * gates it, `sceneToNodes` lowers it under the placement, and the performance
 * boundary bounds a clip that drives it. On screen it was nothing at all: the
 * viewer built one model object per scene node and added it to that node's
 * group, so a hinge existed in the artifact and had no object to turn. A shot
 * could therefore carry a validated, ROM-checked swing that rendered a door
 * standing still, which is the silent drop this package refuses everywhere
 * else.
 *
 * Two things make the joint real, and they are separate:
 *
 * - **The frame.** Each declared joint becomes a `THREE.Object3D` at its own
 *   local transform, parented to its declared parent joint or, for a root
 *   joint, to the placement group the host already built. Its name is
 *   {@link placementChildNode}'s, the engine's own lowering law, so the object a
 *   clip channel names is found by the same string the artifact was gated
 *   against rather than by a second spelling of the prefix.
 * - **The part.** A joint that names a `mesh` takes that part of the prop's model
 *   out of the model root and carries it, so turning the joint turns something
 *   visible. The part does not move when it changes hands: its authored
 *   transform stays MODEL-local, which is the frame `propOccupancyBounds`
 *   measures the prop's volume in and every containment, bearing and clearance
 *   judgment is made against. A leaf hung on a hinge therefore stands exactly
 *   where the record says it stands, and only what carries it changes.
 *
 * Anything that cannot resolve throws rather than being skipped, the rule
 * {@link buildScene} states for an unresolvable node: a silently unparented leaf
 * renders frozen at its model's origin while every other part of the frame
 * looks right, and nothing downstream would report it.
 *
 * A prop drawing an imported appearance has no addressable parts (see
 * {@link createImportedModelObject}), so a joint of one may name no `mesh`; its
 * frame is still built and still turns whatever it holds.
 *
 * What this does NOT do is run a prop profile's drivers. A profile's limits and
 * drivers are resolved by `resolveFrame`, which is the engine's frame solver
 * rather than the viewer's, so a handle declared to mirror its hinge is honored
 * where the shot is gated and stands still where the shot is drawn. Only the
 * channels a clip carries move here, exactly as {@link applyObjectMotions}
 * states for every other object it drives.
 *
 * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Limits this articulation surface to authored object-motion channels.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Materializes those channels at the attachment and interaction boundary.
 * @author Samchon
 */
export const buildPropArticulation = (props: {
  /** The compiled scene whose placements are already built. */
  scene: IAutoMovieScene;
  /** The shot's prop registry, keyed as the compiled artifact carries it. */
  props: readonly IAutoMoviePropSpec[];
  /** The group each scene node was built under, by scene node id. */
  nodeObjects: ReadonlyMap<string, THREE.Object3D>;
  /** The built model of each scene node, by scene node id. */
  modelObjects: ReadonlyMap<string, IAutoMovieModelObject>;
}): IAutoMovieBuiltPropArticulation => {
  const registry = new Map<string, IAutoMoviePropSpec>();
  for (const spec of props.props)
    if (!registry.has(spec.node)) registry.set(spec.node, spec);

  const joints = new Map<string, THREE.Object3D>();
  const rests: IJointRest[] = [];
  for (const placement of props.scene.nodes) {
    const spec = registry.get(placement.model);
    // A placement no prop registry claims is a set piece or an actor, and a
    // rigid prop declares no joints; both stand exactly as the host built them.
    if (spec === undefined || spec.articulation === null) continue;
    const articulation = spec.articulation;
    const group = props.nodeObjects.get(placement.id);
    const built = props.modelObjects.get(placement.id);
    if (group === undefined || built === undefined)
      throw new Error(
        `prop "${placement.model}" is placed at scene node "${placement.id}", which the host built no object for`,
      );

    // Every frame first, then the parenting: a joint may declare its parent
    // after itself, which `forgeProp` allows and a single pass would drop.
    const local = new Map<string, THREE.Object3D>();
    for (const joint of articulation.nodes) {
      const object = new THREE.Group();
      object.name = placementChildNode(placement.id, joint.id);
      applyTransform(object, joint.transform);
      local.set(joint.id, object);
      joints.set(object.name, object);
      rests.push({
        object,
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      });
    }
    for (const joint of articulation.nodes) {
      const object = local.get(joint.id)!;
      if (joint.parent === null) {
        group.add(object);
        continue;
      }
      const parent = local.get(joint.parent);
      if (parent === undefined)
        throw new Error(
          `prop joint "${object.name}" declares parent "${joint.parent}", which this prop does not declare`,
        );
      parent.add(object);
    }
    // World matrices before any part moves, because the move preserves them.
    group.updateMatrixWorld(true);
    for (const joint of articulation.nodes) {
      if (joint.mesh === null) continue;
      const part = built.parts.get(joint.mesh);
      if (part === undefined)
        throw new Error(
          `prop joint "${placementChildNode(placement.id, joint.id)}" drives part "${joint.mesh}", which its built model does not carry`,
        );
      // `attach`, not `add`: a part's authored transform is MODEL-local, which
      // is the frame `propOccupancyBounds` measures its volume in and every
      // containment, bearing and clearance judgment is made against. Reparenting
      // with `add` would reinterpret that same transform as joint-local, so the
      // engine and the frame would disagree about where the leaf is by exactly
      // the hinge's own offset. `attach` keeps the part where the model put it
      // and only changes what carries it afterwards.
      local.get(joint.id)!.attach(part);
    }
  }

  return {
    joints,
    restore: (): void => {
      for (const rest of rests) {
        rest.object.position.copy(rest.position);
        rest.object.quaternion.copy(rest.quaternion);
        rest.object.scale.copy(rest.scale);
      }
    },
  };
};
