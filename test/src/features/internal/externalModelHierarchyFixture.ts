import {
  AutoMovieExternalModelIngestProfile,
  inspectAutoMovieExternalModelBytes,
} from "@automovie/ingest";

/** In-memory node declarations shared by the model admission scenarios. */
export interface IExternalModelHierarchyNode {
  name?: string;
  mesh?: number;
  skin?: number;
  children?: number[];
  matrix?: number[];
  scale?: number[];
}

/** A resident model with weighted hips and a two-key rotation animation. */
export const createExternalModelHierarchyFixture = () => {
  const payload = Buffer.alloc(100);
  for (let vertex = 0; vertex < 3; ++vertex) payload[48 + vertex * 4] = 255;
  payload.writeFloatLE(1, 64);
  payload.writeFloatLE(1, 80);
  payload.writeFloatLE(1, 96);
  return {
    payload,
    document: {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 100, uri: "actor.bin" }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 12 },
        { buffer: 0, byteOffset: 48, byteLength: 12 },
        { buffer: 0, byteOffset: 60, byteLength: 8 },
        { buffer: 0, byteOffset: 68, byteLength: 32 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
        { bufferView: 1, componentType: 5121, count: 3, type: "VEC4" },
        {
          bufferView: 2,
          componentType: 5121,
          normalized: true,
          count: 3,
          type: "VEC4",
        },
        { bufferView: 3, componentType: 5126, count: 2, type: "SCALAR" },
        { bufferView: 4, componentType: 5126, count: 2, type: "VEC4" },
      ],
      meshes: [
        {
          primitives: [
            { attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } },
          ],
        },
      ],
      nodes: [
        { mesh: 0, skin: 0, name: "Actor" },
        { name: "Hips" },
      ] as IExternalModelHierarchyNode[],
      skins: [{ joints: [1] }],
      scenes: [{ nodes: [0, 1] }] as Array<{ nodes?: number[] }> | undefined,
      scene: undefined as number | undefined,
      animations: [
        {
          samplers: [{ input: 3, output: 4 }],
          channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
        },
      ],
    },
  };
};

/** A flat declaration whose parent chain has the requested number of nodes. */
export const createExternalModelHierarchyChain = (length: number) => {
  const fixture = createExternalModelHierarchyFixture();
  fixture.document.nodes = Array.from({ length }, (_, index) =>
    index === 0 ? { mesh: 0 } : { children: [index - 1] },
  );
  fixture.document.skins = [];
  fixture.document.scenes = [{ nodes: [length - 1] }];
  return fixture;
};

/** Feed the same scene declarations to each profile with resident bytes only. */
export const inspectExternalModelHierarchyFixture = (
  fixture: ReturnType<typeof createExternalModelHierarchyFixture>,
  profile: AutoMovieExternalModelIngestProfile,
) => {
  const vrm = profile === "vrm-humanoid-v1";
  const document = vrm
    ? {
        ...fixture.document,
        extensionsUsed: ["VRMC_vrm"],
        extensions: {
          VRMC_vrm: {
            specVersion: "1.0",
            humanoid: { humanBones: { hips: { node: 1 } } },
          },
        },
      }
    : fixture.document;
  const json = Buffer.from(JSON.stringify(document), "utf8");
  return inspectAutoMovieExternalModelBytes({
    path: vrm ? "public/models/actor.vrm" : "public/models/actor.gltf",
    bytes: vrm ? glb(json) : json,
    profile,
    resolveResource: () => fixture.payload,
  });
};

const glb = (json: Buffer): Buffer => {
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(20 + paddedLength, 0x20);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(paddedLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  json.copy(bytes, 20);
  return bytes;
};
