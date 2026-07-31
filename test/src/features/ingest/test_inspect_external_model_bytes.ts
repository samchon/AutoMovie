import { inspectAutoMovieExternalModelBytes } from "@automovie/ingest";
import { TestValidator } from "@nestia/e2e";

/** External model inspection binds exact containers, profiles and sidecars. */
export const test_inspect_external_model_bytes = (): void => {
  const source = modelDocument();
  const gltf = Buffer.from(JSON.stringify(source), "utf8");
  const inspection = inspectAutoMovieExternalModelBytes({
    path: "public/models/actor.gltf",
    bytes: gltf,
    profile: "gltf-static-v1",
  });
  TestValidator.equals("glTF inventory")(inspection)({
    format: "gltf",
    version: "2.0",
    counts: { nodes: 2, meshes: 1, skins: 1, animations: 0 },
    extensions: [],
    externalResources: ["actor.bin", "actor.png"],
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
    }).format === "vrm",
  );
  TestValidator.predicate(
    "humanoid glTF profile resolves a skin joint",
    inspectAutoMovieExternalModelBytes({
      path: "public/models/actor.gltf",
      bytes: gltf,
      profile: "gltf-humanoid-v1",
    }).counts.skins === 1,
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
        }),
      ),
  );
};

const modelDocument = () => ({
  asset: { version: "2.0" },
  buffers: [{ byteLength: 36, uri: "actor.bin" }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: "VEC3",
    },
  ],
  images: [{ uri: "actor.png" }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ mesh: 0, name: "Actor" }, { name: "Hips" }],
  skins: [{ joints: [1] }],
  scenes: [{ nodes: [0, 1] }],
});

const glb = (document: object): Buffer => {
  const source = Buffer.from(JSON.stringify(document), "utf8");
  const padding = (4 - (source.length % 4)) % 4;
  const json = Buffer.concat([source, Buffer.alloc(padding, 0x20)]);
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
