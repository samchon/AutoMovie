import { inspectAutoMovieExternalModelBytes } from "@automovie/ingest";
import { TestValidator } from "@nestia/e2e";

/**
 * External model inspection binds exact containers, profiles and sidecars.
 *
 * Scenarios:
 *
 * 1. A JSON glTF resolves its exact inventory, sidecar bytes and static profile.
 * 2. A VRM accepts mandatory space padding while a GLB rejects NUL padding,
 *    pinning the glTF 2.0 JSON chunk boundary.
 * 3. A humanoid glTF resolves a weighted skin joint.
 * 4. Truncated containers, unknown profiles, absent rigs, short resources, missing
 *    BIN payloads and unweighted humanoid joints are refused.
 */
export const test_inspect_external_model_bytes = (): void => {
  const source = modelDocument();
  const gltf = Buffer.from(JSON.stringify(source), "utf8");
  const inspection = inspectAutoMovieExternalModelBytes({
    path: "public/models/actor.gltf",
    bytes: gltf,
    profile: "gltf-static-v1",
    resolveResource: (uri) =>
      uri === "actor.bin"
        ? modelPayload()
        : uri === "actor.png"
          ? Buffer.from([1])
          : null,
  });
  TestValidator.equals("glTF inventory", inspection, {
    profile: "gltf-static-v1",
    format: "gltf",
    version: "2.0",
    counts: { nodes: 2, meshes: 1, skins: 1, animations: 0 },
    extensions: [],
    resources: [
      { uri: "actor.bin", kind: "buffer", byteLength: 60 },
      { uri: "actor.png", kind: "image", byteLength: null },
    ],
    humanoidBones: [],
  });

  const vrm = glb({
    ...source,
    extensionsUsed: ["VRMC_vrm"],
    extensions: {
      VRMC_vrm: {
        specVersion: "1.0",
        humanoid: { humanBones: { hips: { node: 1 } } },
      },
    },
  });
  TestValidator.predicate(
    "VRM container/profile is parsed from resident bytes",
    inspectAutoMovieExternalModelBytes({
      path: "public/models/actor.vrm",
      bytes: vrm,
      profile: "vrm-humanoid-v1",
      resolveResource: (uri) =>
        uri === "actor.bin"
          ? modelPayload()
          : uri === "actor.png"
            ? Buffer.from([1])
            : null,
    }).format === "vrm",
  );
  const inspectStaticGlb = (paddingByte: number) =>
    inspectAutoMovieExternalModelBytes({
      path: "public/models/actor.glb",
      bytes: glb(source, paddingByte),
      profile: "gltf-static-v1",
      resolveResource: (uri) =>
        uri === "actor.bin"
          ? modelPayload()
          : uri === "actor.png"
            ? Buffer.from([1])
            : null,
    });
  TestValidator.equals(
    "GLB JSON chunks accept mandatory space padding",
    inspectStaticGlb(0x20).format,
    "glb",
  );
  let nulPaddingError: string | null = null;
  try {
    inspectStaticGlb(0x00);
  } catch (error) {
    nulPaddingError = error instanceof Error ? error.message : String(error);
  }
  TestValidator.predicate(
    "GLB JSON chunks reject NUL instead of mandatory space padding",
    nulPaddingError?.startsWith("External model JSON is invalid:") === true,
  );
  TestValidator.predicate(
    "humanoid glTF profile resolves a skin joint",
    inspectAutoMovieExternalModelBytes({
      path: "public/models/actor.gltf",
      bytes: gltf,
      profile: "gltf-humanoid-v1",
      resolveResource: (uri) =>
        uri === "actor.bin"
          ? modelPayload()
          : uri === "actor.png"
            ? Buffer.from([1])
            : null,
    }).humanoidBones.some(
      (mapping) =>
        mapping.bone === "hips" && mapping.node === 1 && mapping.weighted,
    ),
  );
  TestValidator.predicate(
    "malformed bytes, unsupported profiles and missing rigs are refused",
    throws(() =>
      inspectAutoMovieExternalModelBytes({
        path: "public/models/actor.glb",
        bytes: vrm.subarray(0, vrm.length - 1),
        profile: "vrm-humanoid-v1",
      }),
    ) &&
      throws(() =>
        inspectAutoMovieExternalModelBytes({
          path: "public/models/actor.gltf",
          bytes: gltf,
          profile: "future-profile",
        }),
      ) &&
      throws(() =>
        inspectAutoMovieExternalModelBytes({
          path: "public/models/actor.gltf",
          bytes: Buffer.from(
            JSON.stringify({
              ...source,
              nodes: source.nodes.slice(0, 1),
              skins: undefined,
              scenes: [{ nodes: [0] }],
            }),
          ),
          profile: "gltf-humanoid-v1",
          resolveResource: (uri) =>
            uri === "actor.bin" ? modelPayload() : Buffer.from([1]),
        }),
      ) &&
      throws(() =>
        inspectAutoMovieExternalModelBytes({
          path: "public/models/actor.gltf",
          bytes: gltf,
          profile: "gltf-static-v1",
          resolveResource: (uri) =>
            uri === "actor.bin" ? Buffer.alloc(1) : Buffer.from([1]),
        }),
      ) &&
      throws(() =>
        inspectAutoMovieExternalModelBytes({
          path: "public/models/actor.glb",
          bytes: glb({
            ...source,
            buffers: [{ byteLength: 60 }],
            images: [],
          }),
          profile: "gltf-static-v1",
        }),
      ) &&
      throws(() =>
        inspectAutoMovieExternalModelBytes({
          path: "public/models/actor.gltf",
          bytes: gltf,
          profile: "gltf-humanoid-v1",
          resolveResource: (uri) =>
            uri === "actor.bin" ? Buffer.alloc(60) : Buffer.from([1]),
        }),
      ),
  );
};

const modelDocument = () => ({
  asset: { version: "2.0" },
  buffers: [{ byteLength: 60, uri: "actor.bin" }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 12 },
    { buffer: 0, byteOffset: 48, byteLength: 12 },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: "VEC3",
    },
    {
      bufferView: 1,
      componentType: 5121,
      count: 3,
      type: "VEC4",
    },
    {
      bufferView: 2,
      componentType: 5121,
      normalized: true,
      count: 3,
      type: "VEC4",
    },
  ],
  images: [{ uri: "actor.png" }],
  meshes: [
    {
      primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }],
    },
  ],
  nodes: [{ mesh: 0, skin: 0, name: "Actor" }, { name: "Hips" }],
  skins: [{ joints: [1] }],
  scenes: [{ nodes: [0, 1] }],
});

const modelPayload = (): Buffer => {
  const bytes = Buffer.alloc(60);
  for (let vertex = 0; vertex < 3; ++vertex) bytes[48 + vertex * 4] = 255;
  return bytes;
};

const glb = (document: object, paddingByte = 0x20): Buffer => {
  const source = Buffer.from(JSON.stringify(document), "utf8");
  const padding = 4 - (source.length % 4);
  const json = Buffer.concat([source, Buffer.alloc(padding, paddingByte)]);
  const output = Buffer.alloc(20 + json.length);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  json.copy(output, 20);
  return output;
};

const throws = (closure: () => unknown): boolean => {
  try {
    closure();
    return false;
  } catch {
    return true;
  }
};
