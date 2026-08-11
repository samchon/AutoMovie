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

type AutoMovieNodeTrackPath = "translation" | "rotation" | "scale" | "weights";

/**
 * The automovie-core payload an imported glTF/GLB resolves to.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-scene-graph-preservation Preserves source nodes and animations as stable project-native identities.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-external-adoption-alternatives Implements the native external-scene interpretation result.
 */
export interface IAutoMovieIngestResult {
  /**
   * The scene graph as a flat list of core nodes (parent by id reference).
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-scene-graph-preservation Retains node identity, hierarchy, transform, and bound object references.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-external-adoption-alternatives Preserves selected scene elements during native interpretation.
   */
  nodes: IAutoMovieNode[];

  /**
   * One clip per glTF animation, its tracks targeting node TRS / weights.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Preserves source key times in the returned clips.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Emits the general flat-array clip form.
   */
  clips: IAutoMovieClip[];
}

/**
 * Ingest a parsed glTF/GLB {@link Document} into automovie's **core** model (the
 * node graph and animation clips), with no three.js and no humanoid
 * assumptions.
 *
 * This is the import side of the pipeline: `@gltf-transform/core` parses the
 * bytes headlessly (so the same loader runs in CI, a worker, or a render farm),
 * and this mapper rewrites glTF's structures onto automovie's interface. The
 * mapping is deliberately structural and lossless-where-it-matters: every glTF
 * node becomes an {@link IAutoMovieNode} (TRS, parent, kind, and the
 * mesh/camera/ skin it carries), and every glTF animation becomes an
 * {@link IAutoMovieClip} whose tracks are glTF channel+sampler pairs
 * ({@link IAutoMovieTrack}), the exact forms the engine's sample pass already
 * consumes. Humanoid retargeting (mapping bones onto the VRM slots) is a later,
 * separate stage; this layer stays generic so props, cameras, and characters
 * all import the same way.
 *
 * Node identity: glTF nodes have no stable id, so each is keyed by its index
 * (`node_{i}`), deterministic and collision-free even when names repeat. All
 * cross-references (a child's `parent`, a channel's target) use the same key.
 *
 * @author Samchon
 * @evidence requirements/asset-authoring/README.md#자산-저작-요구사항 Converts a selected external scene into project-native structural facts.
 * @evidence requirements/external-inputs/README.md#외부-입력-요구사항 Consumes a caller-selected parsed document without acquisition authority.
 * @evidence requirements/external-inputs/README.md#external-inputs-scope Performs deterministic normalization and no provider or source selection.
 * @evidence requirements/external-inputs/README.md#external-inputs-lifecycle Represents the normalization stage after inspection and before composition.
 * @evidence requirements/motion/README.md#동작-요구사항 Converts embedded glTF animations into general project motion clips.
 * @evidence specifications/asset-and-representation/README.md#자산과-표현-시스템-사양 Emits project node and clip representations from external scene facts.
 * @evidence specifications/asset-and-representation/README.md#asset-spec-readme-boundary Implements the external scene-graph representation subset.
 * @evidence specifications/interchange-and-adoption/README.md#interchange와-adoption-시스템-계약 Implements the parsed-document to native-representation boundary.
 * @evidence specifications/interchange-and-adoption/README.md#interchange-system-boundary Operates only on a provided document and performs no acquisition.
 * @evidence specifications/interchange-and-adoption/README.md#interchange-adoption-lifecycle Materializes normalized elements for a later explicit adoption record.
 * @evidence specifications/interchange-and-adoption/README.md#interchange-contract-surfaces Returns typed nodes and clips with explicit structural failures.
 * @evidence specifications/performance-motion-and-staging/README.md#퍼포먼스-모션과-스테이징-시스템-명세 Supplies source-order clips to the general motion pipeline.
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-gltf-scene Maps a selected glTF scene's nodes, meshes, cameras, skins, and animations.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-adoption-mode This low-level mapper receives no user adoption-mode decision.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-group-composition Group membership and local placement are authored after normalization.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-conversion-receipt Manifest digests and conversion receipts are compiler responsibilities.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-provenance-digest A parsed Document does not carry the manifest byte digest.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-bounded-decoder Byte and container bounds are checked by the preceding inspector and loader.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-resource-closure Buffer and image closure is resolved before a Document reaches this mapper.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-semantic-enrichment This generic mapper does not assign semantic rig, role, or material meaning.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-replacement No replacement or dependent-revision ledger is created.
 * @evidenceExclude requirements/asset-authoring/external-assets.md#asset-external-secret-boundary This in-memory structural mapper receives no credentials or provider settings.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement The output is native data rather than immutable direct source placement.
 * @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-native-reinterpretation Rewrites each selected source node and animation into project-native forms.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-group-composition No group relation is created by document normalization.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-selection-overrides The caller selects the document; this mapper accepts no subset or override record.
 * @evidenceExclude requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-intent-persistence Refresh and relink replay belong to the compiler-owned adoption record.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Carries source key-time arrays into each emitted track.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation Maps glTF LINEAR, STEP, and CUBICSPLINE modes explicitly.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Missing-channel state is resolved by the playback engine, not import mapping.
 * @evidenceExclude requirements/motion/clips-keyframes-and-interpolation.md#motion-loop-trim No loop or trim decision is present in a glTF Animation object.
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Rejects absent samplers, targets, arrays, and mismatched output arity.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-variant-inheritance No alternative inheritance graph is interpreted.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Source nodes remain nodes rather than becoming prototypes and instances.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-instance-override-resolution No instance override or merge precedence is resolved.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality No logical group composition is created.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation No seeded or procedural instance generation occurs.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-selection-output The mapper emits one normalized result and no compatibility-ranked alternatives.
 * @evidenceExclude specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-failure-compatibility It reports structural mapping failures, not alternative compatibility status.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-direct-placement-boundary Native node conversion is not direct source placement.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-native-reinterpretation-boundary Source-local nodes and tracks map to stable project-native identities.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-group-composition-boundary No group relation graph is created.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution This function receives a complete parsed document and no selection record.
 * @evidenceExclude specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-intent-replay Relink replay and conflict resolution are outside this pure mapper.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Raw digests, adoption mode, profile version, and settings are not present on Document.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Stable index ids preserve source node and animation correspondence.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-loss-ledger This legacy mapper emits no loss or omission ledger.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result The compiler seals result identity after this structural mapping.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-nondeterministic-generation-boundary No generator, seed, platform codec, or network operation is invoked.
 * @evidenceExclude specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-freshness-diff Staleness and conversion diffs belong to the production revision store.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt This legacy mapper has no byte digest or adoption decision to receipt.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Emits source-order key times, values, targets, and interpolation modes.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition No layer, mask, blend, or transition is composed.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event No semantic event or story-clock mapping is present in the core glTF channels.
 * @evidenceExclude specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Sampling and validation receipts are downstream engine concerns.
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
  if (inputArray.length === 0)
    throw new Error(
      `animation channel for node "${targetId}" input times must not be empty`,
    );
  const outputArray = output.getArray();
  if (outputArray === null)
    throw new Error(
      `animation channel for node "${targetId}" output values must have data`,
    );
  if (outputArray.length === 0)
    throw new Error(
      `animation channel for node "${targetId}" output values must not be empty`,
    );

  const targetPath = channel.getTargetPath() as AutoMovieNodeTrackPath;
  const interpolation = toInterpolation(sampler.getInterpolation());
  validateOutputArity({
    targetId,
    targetPath,
    interpolation,
    keyframes: inputArray.length,
    outputValues: outputArray.length,
  });

  return {
    channel: {
      kind: "node",
      node: targetId,
      path: targetPath,
    },
    times: Array.from(inputArray),
    values: Array.from(outputArray),
    interpolation,
  };
};

const toInterpolation = (interp: string): AutoMovieInterpolation =>
  interp === "STEP"
    ? "step"
    : interp === "CUBICSPLINE"
      ? "cubicspline"
      : "linear";

const componentCount = (path: AutoMovieNodeTrackPath): number | null =>
  path === "rotation" ? 4 : path === "weights" ? null : 3;

const validateOutputArity = (props: {
  targetId: string;
  targetPath: AutoMovieNodeTrackPath;
  interpolation: AutoMovieInterpolation;
  keyframes: number;
  outputValues: number;
}): void => {
  const { targetId, targetPath, interpolation, keyframes, outputValues } =
    props;
  const cubicFactor = interpolation === "cubicspline" ? 3 : 1;
  const perKeyframeGroup = keyframes * cubicFactor;
  const fixed = componentCount(targetPath);
  if (fixed !== null) {
    const expected = perKeyframeGroup * fixed;
    if (outputValues !== expected)
      throw new Error(
        `animation channel for node "${targetId}" ${targetPath} output values length must be ${expected}, but was ${outputValues}`,
      );
    return;
  }

  if (outputValues % perKeyframeGroup !== 0)
    throw new Error(
      `animation channel for node "${targetId}" weights output values length must be a multiple of ${perKeyframeGroup}, but was ${outputValues}`,
    );
};
