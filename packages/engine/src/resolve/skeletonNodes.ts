import { IAutoMovieNode, IAutoMovieSkeleton } from "@automovie/interface";

/**
 * The synthetic node above a lowered bone hierarchy that carries the motion's
 * root transform. `"root"` is not a humanoid bone name (the closed
 * `AutoMovieHumanoidBone` union has no such member), so it can never collide
 * with a lowered bone node id.
 */
export const MOTION_ROOT_NODE_ID = "root";

const IDENTITY = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/**
 * Lower a skeleton to the node hierarchy {@link composeScene} walks: a `group`
 * root carrying the motion's root transform, then one `bone` node per bone with
 * the rest translation/rotation and scale pinned to `1` (mirroring
 * `resolvePose`, which never scales bones: see `motionToClip`'s contract).
 *
 * **Naming.** Node ids are `${prefix}${boneName}` and the synthetic root is
 * `${prefix}${MOTION_ROOT_NODE_ID}`. The default empty prefix keeps the S1
 * bare-name convention (one actor per node graph); a scene bridge lowering
 * several actors into ONE graph passes a per-placement prefix (e.g.
 * `"knightA/"`) so two actors sharing bone names stay distinct, the same
 * prefix a multi-actor clip playback must use on its channel node refs (see
 * `motionToClip`'s `nodePrefix`).
 *
 * `rootParent` seats the synthetic root under an existing node (a scene
 * placement group); `null` (the default) keeps it a graph root.
 *
 * @author Samchon
 */
export const lowerSkeletonNodes = (props: {
  /** The rig to lower. */
  skeleton: IAutoMovieSkeleton;
  /** Node-id prefix for every lowered node. Defaults to `""` (bare names). */
  prefix?: string;
  /** Parent node id for the synthetic root, or `null` for a graph root. */
  rootParent?: string | null;
}): IAutoMovieNode[] => {
  const prefix = props.prefix ?? "";
  const rootId = `${prefix}${MOTION_ROOT_NODE_ID}`;
  const nodes: IAutoMovieNode[] = [
    {
      id: rootId,
      name: null,
      parent: props.rootParent ?? null,
      kind: "group",
      transform: { ...IDENTITY },
      mesh: null,
      camera: null,
      light: null,
      skin: null,
    },
  ];
  for (const bone of props.skeleton.bones)
    nodes.push({
      id: `${prefix}${bone.bone}`,
      name: null,
      parent: bone.parent === null ? rootId : `${prefix}${bone.parent}`,
      kind: "bone",
      transform: {
        translation: bone.rest.translation,
        rotation: bone.rest.rotation,
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: null,
      camera: null,
      light: null,
      skin: null,
    });
  return nodes;
};
