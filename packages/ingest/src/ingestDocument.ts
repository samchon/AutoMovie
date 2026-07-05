import {
  AutoMovieInterpolation,
  AutoMovieNodeKind,
  IAutoMovieClip,
  IAutoMovieNode,
  IAutoMovieTrack,
} from "@automovie/interface";
import type {
  AnimationChannel,
  Document,
  Node as GLTFNode,
} from "@gltf-transform/core";

/** The automovie-core payload an imported glTF/GLB resolves to. */
export interface IAutoMovieIngestResult {
  /** The scene graph as a flat list of core nodes (parent by id reference). */
  nodes: IAutoMovieNode[];

  /** One clip per glTF animation, its tracks targeting node TRS / weights. */
  clips: IAutoMovieClip[];
}

/**
 * Ingest a parsed glTF/GLB {@link Document} into automovie's **core** model —
 * the node graph and animation clips — with no three.js and no humanoid
 * assumptions.
 *
 * This is the import side of the pipeline: `@gltf-transform/core` parses the
 * bytes headlessly (so the same loader runs in CI, a worker, or a render farm),
 * and this mapper rewrites glTF's structures onto automovie's interface. The
 * mapping is deliberately structural and lossless-where-it-matters: every glTF
 * node becomes an {@link IAutoMovieNode} (TRS, parent, kind, and the
 * mesh/camera/ skin it carries), and every glTF animation becomes an
 * {@link IAutoMovieClip} whose tracks are glTF channel+sampler pairs
 * ({@link IAutoMovieTrack}) — the exact forms the engine's sample pass already
 * consumes. Humanoid retargeting (mapping bones onto the VRM slots) is a later,
 * separate stage; this layer stays generic so props, cameras, and characters
 * all import the same way.
 *
 * Node identity: glTF nodes have no stable id, so each is keyed by its index
 * (`node_{i}`) — deterministic and collision-free even when names repeat. All
 * cross-references (a child's `parent`, a channel's target) use the same key.
 *
 * @author Samchon
 */
export const ingestDocument = (doc: Document): IAutoMovieIngestResult => {
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

  const nodes: IAutoMovieNode[] = gltfNodes.map((n) => {
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

  const clips: IAutoMovieClip[] = root.listAnimations().map((anim, i) => {
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

const kindOf = (node: GLTFNode, joints: Set<GLTFNode>): AutoMovieNodeKind =>
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
): IAutoMovieTrack => {
  const target = channel.getTargetNode();
  if (target === null) throw new Error("animation channel must target a node");
  const targetId = idByNode.get(target)!;

  const sampler = channel.getSampler();
  if (sampler === null)
    throw new Error(
      `animation channel for node "${targetId}" must have a sampler`,
    );

  const input = sampler.getInput();
  if (input === null)
    throw new Error(
      `animation channel for node "${targetId}" must have input times`,
    );
  const output = sampler.getOutput();
  if (output === null)
    throw new Error(
      `animation channel for node "${targetId}" must have output values`,
    );

  const inputArray = input.getArray();
  if (inputArray === null)
    throw new Error(
      `animation channel for node "${targetId}" input times must have data`,
    );
  const outputArray = output.getArray();
  if (outputArray === null)
    throw new Error(
      `animation channel for node "${targetId}" output values must have data`,
    );

  return {
    channel: {
      kind: "node",
      node: targetId,
      path: channel.getTargetPath() as
        | "translation"
        | "rotation"
        | "scale"
        | "weights",
    },
    times: Array.from(inputArray),
    values: Array.from(outputArray),
    interpolation: toInterpolation(sampler.getInterpolation()),
  };
};

const toInterpolation = (interp: string): AutoMovieInterpolation =>
  interp === "STEP"
    ? "step"
    : interp === "CUBICSPLINE"
      ? "cubicspline"
      : "linear";
