import {
  automovieInterpolation,
  automovieNodeKind,
  IautomovieClip,
  IautomovieNode,
  IautomovieTrack,
} from "@automovie/interface";
import type {
  AnimationChannel,
  Document,
  Node as GLTFNode,
} from "@gltf-transform/core";

/** The automovie-core payload an imported glTF/GLB resolves to. */
export interface IautomovieIngestResult {
  /** The scene graph as a flat list of core nodes (parent by id reference). */
  nodes: IautomovieNode[];

  /** One clip per glTF animation, its tracks targeting node TRS / weights. */
  clips: IautomovieClip[];
}

/**
 * Ingest a parsed glTF/GLB {@link Document} into automovie's **core** model ??the
 * node graph and animation clips ??with no three.js and no humanoid
 * assumptions.
 *
 * This is the import side of the pipeline: `@gltf-transform/core` parses the
 * bytes headlessly (so the same loader runs in CI, a worker, or a render farm),
 * and this mapper rewrites glTF's structures onto automovie's interface. The
 * mapping is deliberately structural and lossless-where-it-matters: every glTF
 * node becomes an {@link IautomovieNode} (TRS, parent, kind, and the mesh/camera/
 * skin it carries), and every glTF animation becomes an {@link IautomovieClip}
 * whose tracks are glTF channel+sampler pairs ({@link IautomovieTrack}) ??the
 * exact forms the engine's sample pass already consumes. Humanoid retargeting
 * (mapping bones onto the VRM slots) is a later, separate stage; this layer
 * stays generic so props, cameras, and characters all import the same way.
 *
 * Node identity: glTF nodes have no stable id, so each is keyed by its index
 * (`node_{i}`) ??deterministic and collision-free even when names repeat. All
 * cross-references (a child's `parent`, a channel's target) use the same key.
 *
 * @author Samchon
 */
export const ingestDocument = (doc: Document): IautomovieIngestResult => {
  const root = doc.getRoot();
  const gltfNodes = root.listNodes();

  // Stable id per glTF node (index-based) and the reverse for channel targets.
  const idByNode = new Map<GLTFNode, string>();
  gltfNodes.forEach((n, i) => idByNode.set(n, `node_${i}`));

  // Parent lookup: a node's parent is whichever node lists it as a child.
  const parentByNode = new Map<GLTFNode, GLTFNode>();
  for (const n of gltfNodes)
    for (const child of n.listChildren()) parentByNode.set(child, n);

  // Joint nodes (members of any skin) are bones.
  const jointSet = new Set<GLTFNode>();
  root
    .listSkins()
    .forEach((skin) => skin.listJoints().forEach((j) => jointSet.add(j)));

  const meshIds = indexIds(root.listMeshes());
  const cameraIds = indexIds(root.listCameras());
  const skinIds = indexIds(root.listSkins());

  const nodes: IautomovieNode[] = gltfNodes.map((n) => {
    const parent = parentByNode.get(n);
    const t = n.getTranslation();
    const r = n.getRotation();
    const s = n.getScale();
    const mesh = n.getMesh();
    const camera = n.getCamera();
    const skin = n.getSkin();
    return {
      id: idByNode.get(n)!,
      name: n.getName() === "" ? null : n.getName(),
      parent: parent !== undefined ? idByNode.get(parent)! : null,
      kind: kindOf(n, jointSet),
      transform: {
        translation: { x: t[0], y: t[1], z: t[2] },
        rotation: { x: r[0], y: r[1], z: r[2], w: r[3] },
        scale: { x: s[0], y: s[1], z: s[2] },
      },
      mesh: mesh !== null ? meshIds.get(mesh)! : null,
      camera: camera !== null ? cameraIds.get(camera)! : null,
      light: null,
      skin: skin !== null ? skinIds.get(skin)! : null,
    };
  });

  const clips: IautomovieClip[] = root.listAnimations().map((anim, i) => {
    const tracks = anim.listChannels().map((ch) => toTrack(ch, idByNode));
    return {
      id: `clip_${i}`,
      name: anim.getName() === "" ? null : anim.getName(),
      duration: tracks.reduce(
        (max, tr) => Math.max(max, tr.times[tr.times.length - 1]!),
        0,
      ),
      loop: false,
      tracks,
    };
  });

  return { nodes, clips };
};

/** Map each item to a stable index id (`prefix` defaults to the position). */
const indexIds = <T>(items: T[]): Map<T, string> => {
  const map = new Map<T, string>();
  items.forEach((item, i) => map.set(item, `${i}`));
  return map;
};

const kindOf = (node: GLTFNode, joints: Set<GLTFNode>): automovieNodeKind =>
  joints.has(node)
    ? "bone"
    : node.getMesh() !== null
      ? "mesh"
      : node.getCamera() !== null
        ? "camera"
        : "group";

const toTrack = (
  channel: AnimationChannel,
  idByNode: Map<GLTFNode, string>,
): IautomovieTrack => {
  const target = channel.getTargetNode()!;
  const sampler = channel.getSampler()!;
  return {
    channel: {
      kind: "node",
      node: idByNode.get(target)!,
      path: channel.getTargetPath() as
        | "translation"
        | "rotation"
        | "scale"
        | "weights",
    },
    times: Array.from(sampler.getInput()!.getArray()!),
    values: Array.from(sampler.getOutput()!.getArray()!),
    interpolation: toInterpolation(sampler.getInterpolation()),
  };
};

const toInterpolation = (interp: string): automovieInterpolation =>
  interp === "STEP"
    ? "step"
    : interp === "CUBICSPLINE"
      ? "cubicspline"
      : "linear";
