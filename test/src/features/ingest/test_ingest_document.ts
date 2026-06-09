import { ingestDocument } from "@autofilm/ingest";
import { IAutoFilmNode } from "@autofilm/interface";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const byName = (nodes: IAutoFilmNode[], name: string): IAutoFilmNode => {
  const n = nodes.find((x) => x.name === name);
  if (n === undefined) throw new Error(`node "${name}" missing`);
  return n;
};

/**
 * Ingest a hand-built glTF {@link Document} into the core node graph + clips,
 * exercising every node kind, every cross-reference, and every interpolation
 * mode the structural mapper distinguishes.
 *
 * The document: a `root` group with a `meshNode` (mesh) and `camNode` (camera)
 * child, plus a `bone` (skin joint), a `skinned` mesh+skin node, and an unnamed
 * node — all under the scene. One named animation drives three channels
 * (translation LINEAR, rotation STEP, scale CUBICSPLINE) and a second, unnamed,
 * empty animation.
 *
 * Scenarios:
 *
 * 1. Every glTF node maps to a core node (six in, six out); each keeps a stable
 *    index id and resolves its `parent` by reference (the mesh/camera nodes
 *    name `root`; `root` and the scene-level nodes are parentless).
 * 2. Kind inference covers all four reachable kinds: a skin joint → `bone` (even
 *    though a mesh would otherwise win), a mesh node → `mesh`, a camera node →
 *    `camera`, everything else → `group`.
 * 3. The mesh / camera / skin id fields are populated when present and `null` when
 *    absent; an unnamed glTF node yields `name: null`; TRS is carried through
 *    verbatim.
 * 4. Each glTF animation becomes a clip; its channels become tracks whose channel
 *    targets the node by id with the right path, and whose interpolation maps
 *    LINEAR→linear, STEP→step, CUBICSPLINE→cubicspline. Clip duration is the
 *    latest keyframe time; the empty unnamed animation yields a null-named,
 *    zero-duration, trackless clip.
 */
export const test_ingest_document = (): void => {
  const doc = new Document();
  const scene = doc.createScene();

  const mesh = doc.createMesh("m");
  const cam = doc.createCamera("c").setType("perspective");

  const meshNode = doc
    .createNode("meshNode")
    .setMesh(mesh)
    .setTranslation([1, 2, 3]);
  const camNode = doc.createNode("camNode").setCamera(cam);
  const bone = doc.createNode("bone");
  const skin = doc.createSkin("skin").addJoint(bone);
  const skinned = doc.createNode("skinned").setMesh(mesh).setSkin(skin);
  const unnamed = doc.createNode();
  const root = doc.createNode("root").addChild(meshNode).addChild(camNode);
  scene.addChild(root);
  scene.addChild(bone);
  scene.addChild(skinned);
  scene.addChild(unnamed);

  // animation: T linear, R step, S cubicspline
  const time = doc
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Float32Array([0, 1]));
  const trans = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 10, 0, 0]));
  const rot = doc
    .createAccessor()
    .setType("VEC4")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]));
  const scl = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array(new Array(18).fill(1)));

  const sT = doc
    .createAnimationSampler()
    .setInput(time)
    .setOutput(trans)
    .setInterpolation("LINEAR");
  const sR = doc
    .createAnimationSampler()
    .setInput(time)
    .setOutput(rot)
    .setInterpolation("STEP");
  const sS = doc
    .createAnimationSampler()
    .setInput(time)
    .setOutput(scl)
    .setInterpolation("CUBICSPLINE");
  const cT = doc
    .createAnimationChannel()
    .setTargetNode(meshNode)
    .setTargetPath("translation")
    .setSampler(sT);
  const cR = doc
    .createAnimationChannel()
    .setTargetNode(meshNode)
    .setTargetPath("rotation")
    .setSampler(sR);
  const cS = doc
    .createAnimationChannel()
    .setTargetNode(meshNode)
    .setTargetPath("scale")
    .setSampler(sS);
  doc
    .createAnimation("walk")
    .addSampler(sT)
    .addSampler(sR)
    .addSampler(sS)
    .addChannel(cT)
    .addChannel(cR)
    .addChannel(cS);
  doc.createAnimation(); // unnamed, empty

  const { nodes, clips } = ingestDocument(doc);

  // 1. node count + parent references
  TestValidator.equals("node count", nodes.length, 6);
  const rootId = byName(nodes, "root").id;
  TestValidator.equals(
    "mesh node parents root",
    byName(nodes, "meshNode").parent,
    rootId,
  );
  TestValidator.equals(
    "camera node parents root",
    byName(nodes, "camNode").parent,
    rootId,
  );
  TestValidator.equals(
    "root is parentless",
    byName(nodes, "root").parent,
    null,
  );

  // 2. kind inference (all four)
  TestValidator.equals("joint is bone", byName(nodes, "bone").kind, "bone");
  TestValidator.equals(
    "mesh node is mesh",
    byName(nodes, "meshNode").kind,
    "mesh",
  );
  TestValidator.equals(
    "camera node is camera",
    byName(nodes, "camNode").kind,
    "camera",
  );
  TestValidator.equals("root is group", byName(nodes, "root").kind, "group");

  // 3. payload ids, unnamed → null, TRS carried
  const mn = byName(nodes, "meshNode");
  TestValidator.equals("mesh id present", mn.mesh !== null, true);
  TestValidator.equals("mesh node has no camera", mn.camera, null);
  TestValidator.equals("mesh node has no skin", mn.skin, null);
  TestValidator.equals(
    "camera id present",
    byName(nodes, "camNode").camera !== null,
    true,
  );
  TestValidator.equals(
    "skinned has skin id",
    byName(nodes, "skinned").skin !== null,
    true,
  );
  TestValidator.equals(
    "unnamed node name is null",
    nodes.find((n) => n.name === null) !== undefined,
    true,
  );
  TestValidator.predicate(
    "translation carried",
    nclose(mn.transform.translation.x, 1),
  );

  // 4. clips, tracks, interpolation mapping, duration
  TestValidator.equals("clip count", clips.length, 2);
  const walk = clips.find((c) => c.name === "walk")!;
  TestValidator.equals("walk track count", walk.tracks.length, 3);
  TestValidator.predicate("walk duration", nclose(walk.duration, 1));
  const path = (p: string) =>
    walk.tracks.find((t) => t.channel.kind === "node" && t.channel.path === p)!;
  TestValidator.equals(
    "translation linear",
    path("translation").interpolation,
    "linear",
  );
  TestValidator.equals("rotation step", path("rotation").interpolation, "step");
  TestValidator.equals(
    "scale cubicspline",
    path("scale").interpolation,
    "cubicspline",
  );
  const translationChannel = path("translation").channel;
  TestValidator.equals(
    "track targets node by id",
    translationChannel.kind === "node" && translationChannel.node,
    mn.id,
  );
  TestValidator.equals(
    "translation values",
    path("translation").values,
    [0, 0, 0, 10, 0, 0],
  );

  const empty = clips.find((c) => c.name === null)!;
  TestValidator.equals("empty clip has no tracks", empty.tracks.length, 0);
  TestValidator.equals("empty clip zero duration", empty.duration, 0);
};
