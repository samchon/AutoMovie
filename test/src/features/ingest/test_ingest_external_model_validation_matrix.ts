import { inspectAutoMovieExternalModelBytes } from "@automovie/ingest";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

type JsonObject = Record<string, unknown>;
type Path = readonly (number | string)[];

/**
 * Pin the byte inspector's structural, resource, accessor, and humanoid refusal
 * boundaries with one-property negative twins.
 */
export const test_ingest_external_model_validation_matrix = (): void => {
  const facts: [string, () => boolean][] = [
    ["rootMustBeObject", () => rejects(null, "glTF root must be an object")],
    [
      "assetMustBeObject",
      () => rejects(changed(["asset"], null), "glTF asset must be an object"),
    ],
    [
      "assetVersionMustBeTwo",
      () => rejects(changed(["asset", "version"], "1.0"), "asset.version"),
    ],
    [
      "optionalInventoryMustBeArray",
      () => rejects(changed(["nodes"], {}), "nodes must be an array"),
    ],
    [
      "nodeMustBeObject",
      () => rejects(changed(["nodes", 0], null), "nodes[0] must be an object"),
    ],
    [
      "nodeMeshMustResolve",
      () => rejects(changed(["nodes", 0, "mesh"], 9), "nodes[0].mesh"),
    ],
    [
      "nodeSkinMustResolve",
      () => rejects(changed(["nodes", 0, "skin"], 0), "nodes[0].skin"),
    ],
    [
      "nodeChildrenMustBeArray",
      () =>
        rejects(
          changed(["nodes", 0, "children"], 0),
          "children must be an array",
        ),
    ],
    [
      "nodeChildMustResolve",
      () => rejects(changed(["nodes", 0, "children"], [9]), "children[0]"),
    ],
    [
      "sceneMustBeObject",
      () =>
        rejects(changed(["scenes", 0], null), "scenes[0] must be an object"),
    ],
    [
      "sceneNodeMustResolve",
      () => rejects(changed(["scenes", 0, "nodes"], [9]), "scenes[0].nodes[0]"),
    ],
    [
      "bufferMustBeObject",
      () =>
        rejects(changed(["buffers", 0], null), "buffers[0] must be an object"),
    ],
    [
      "bufferLengthMustBeNumber",
      () =>
        rejects(
          changed(["buffers", 0, "byteLength"], "12"),
          "positive safe integer",
        ),
    ],
    [
      "bufferLengthMustBeSafe",
      () =>
        rejects(
          changed(["buffers", 0, "byteLength"], 1.5),
          "positive safe integer",
        ),
    ],
    [
      "bufferLengthMustBePositive",
      () =>
        rejects(
          changed(["buffers", 0, "byteLength"], 0),
          "positive safe integer",
        ),
    ],
    [
      "jsonBufferNeedsUri",
      () =>
        rejects(changed(["buffers", 0, "uri"], undefined), "uri is required"),
    ],
    [
      "meshMustBeObject",
      () =>
        rejects(changed(["meshes", 0], null), "meshes[0] must be an object"),
    ],
    [
      "primitivesMustBeArray",
      () =>
        rejects(
          changed(["meshes", 0, "primitives"], null),
          "primitives must be an array",
        ),
    ],
    [
      "meshNeedsPrimitive",
      () =>
        rejects(
          changed(["meshes", 0, "primitives"], []),
          "has no render primitive",
        ),
    ],
    [
      "primitiveMustBeObject",
      () =>
        rejects(
          changed(["meshes", 0, "primitives", 0], null),
          "primitives[0] must be an object",
        ),
    ],
    [
      "attributesMustBeObject",
      () =>
        rejects(
          changed(["meshes", 0, "primitives", 0, "attributes"], null),
          "attributes must be an object",
        ),
    ],
    [
      "positionIsRequired",
      () =>
        rejects(
          changed(
            ["meshes", 0, "primitives", 0, "attributes", "POSITION"],
            undefined,
          ),
          "attributes.POSITION",
        ),
    ],
    [
      "indicesMustResolve",
      () =>
        rejects(
          changed(["meshes", 0, "primitives", 0, "indices"], 9),
          ".indices",
        ),
    ],
    [
      "skinMustBeObject",
      () =>
        rejects(
          humanoidChanged(["skins", 0], null),
          "skins[0] must be an object",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "skinJointsMustBeArray",
      () =>
        rejects(
          humanoidChanged(["skins", 0, "joints"], null),
          "joints must be an array",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "skinNeedsJoint",
      () =>
        rejects(
          humanoidChanged(["skins", 0, "joints"], []),
          "has no joints",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "skinJointMustResolve",
      () =>
        rejects(
          humanoidChanged(["skins", 0, "joints"], [9]),
          "joints[0]",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "bufferViewMustBeObject",
      () =>
        rejects(
          changed(["bufferViews", 0], null),
          "bufferViews[0] must be an object",
        ),
    ],
    [
      "bufferViewBufferMustResolve",
      () =>
        rejects(
          changed(["bufferViews", 0, "buffer"], 9),
          "bufferViews[0].buffer",
        ),
    ],
    [
      "bufferViewLengthMustBePositive",
      () =>
        rejects(
          changed(["bufferViews", 0, "byteLength"], 0),
          "positive safe integer",
        ),
    ],
    [
      "bufferViewOffsetMustBeNumber",
      () =>
        rejects(
          changed(["bufferViews", 0, "byteOffset"], "0"),
          "non-negative safe integer",
        ),
    ],
    [
      "bufferViewOffsetMustBeSafe",
      () =>
        rejects(
          changed(["bufferViews", 0, "byteOffset"], 0.5),
          "non-negative safe integer",
        ),
    ],
    [
      "bufferViewOffsetMustBeNonnegative",
      () =>
        rejects(
          changed(["bufferViews", 0, "byteOffset"], -1),
          "non-negative safe integer",
        ),
    ],
    ...["wide", "small", "large", "unaligned"].map(
      (name, index): [string, () => boolean] => [
        `byteStride${name}`,
        () =>
          rejects(
            changed(["bufferViews", 0, "byteStride"], ["4", 3, 256, 6][index]),
            "byteStride must be a 4-byte-aligned integer",
          ),
      ],
    ),
    [
      "accessorMustBeObject",
      () =>
        rejects(
          changed(["accessors", 0], null),
          "accessors[0] must be an object",
        ),
    ],
    [
      "accessorBufferViewMustResolve",
      () =>
        rejects(
          changed(["accessors", 0, "bufferView"], 9),
          "accessors[0].bufferView",
        ),
    ],
    [
      "accessorCountMustBePositive",
      () =>
        rejects(changed(["accessors", 0, "count"], 0), "positive safe integer"),
    ],
    [
      "accessorOffsetMustBeNonnegative",
      () =>
        rejects(
          changed(["accessors", 0, "byteOffset"], -1),
          "non-negative safe integer",
        ),
    ],
    [
      "componentTypeMustBeNumber",
      () =>
        rejects(
          changed(["accessors", 0, "componentType"], "FLOAT"),
          "unsupported componentType",
        ),
    ],
    [
      "componentTypeMustBeSupported",
      () =>
        rejects(
          changed(["accessors", 0, "componentType"], 999),
          "unsupported componentType",
        ),
    ],
    [
      "accessorShapeMustBeString",
      () =>
        rejects(
          changed(["accessors", 0, "type"], 3),
          "unsupported componentType or shape",
        ),
    ],
    [
      "accessorShapeMustBeSupported",
      () =>
        rejects(
          changed(["accessors", 0, "type"], "VEC5"),
          "unsupported componentType or shape",
        ),
    ],
    [
      "accessorNeedsStorage",
      () =>
        rejects(
          changed(["accessors", 0, "bufferView"], undefined),
          "needs a bufferView",
        ),
    ],
    [
      "strideMustCoverElement",
      () =>
        rejects(
          changed(["bufferViews", 0, "byteStride"], 8),
          "element size 12 exceeds",
        ),
    ],
    [
      "accessorMustFitView",
      () =>
        rejects(
          changed(["bufferViews", 0, "byteLength"], 8),
          "requires 12 bytes",
        ),
    ],
    [
      "imageMustBeObject",
      () => rejects(changed(["images"], [null]), "images[0] must be an object"),
    ],
    [
      "embeddedImageNeedsView",
      () => rejects(changed(["images"], [{}]), "images[0].bufferView"),
    ],
    [
      "extensionsMustBeObject",
      () =>
        rejects(changed(["extensions"], []), "extensions must be an object"),
    ],
    [
      "extensionNameMustBeString",
      () => rejects(changed(["extensionsUsed"], [1]), "extensionsUsed[0]"),
    ],
    [
      "extensionNameMustBeNonblank",
      () => rejects(changed(["extensionsUsed"], [" "]), "extensionsUsed[0]"),
    ],
    [
      "bufferUriMustBeString",
      () =>
        rejects(
          changed(["buffers", 0, "uri"], 3),
          "must be a non-empty URI string",
        ),
    ],
    [
      "bufferUriMustBeNonempty",
      () =>
        rejects(
          changed(["buffers", 0, "uri"], ""),
          "must be a non-empty URI string",
        ),
    ],
    [
      "conflictingBufferLengths",
      () =>
        rejects(conflictingBuffers(), "conflicting resource roles or lengths"),
    ],
    [
      "bufferImageRoleConflict",
      () =>
        rejects(
          changed(["images"], [{ uri: "mesh.bin" }]),
          "declared as both a buffer and an image",
        ),
    ],
    [
      "missingExternalBuffer",
      () =>
        rejects(
          baseDocument(),
          "has no compiler-resolved resident bytes",
          "gltf-static-v1",
          () => null,
        ),
    ],
    [
      "externalBufferLengthMismatch",
      () =>
        rejects(
          baseDocument(),
          "has 1 bytes, not declared",
          "gltf-static-v1",
          () => Buffer.alloc(1),
        ),
    ],
    [
      "missingExternalImage",
      () =>
        rejects(
          changed(["images"], [{ uri: "image.png" }]),
          "has no non-empty compiler-resolved resident bytes",
          "gltf-static-v1",
          resolveOnlyBuffer,
        ),
    ],
    [
      "emptyExternalImage",
      () =>
        rejects(
          changed(["images"], [{ uri: "image.png" }]),
          "has no non-empty compiler-resolved resident bytes",
          "gltf-static-v1",
          (uri) => (uri === "mesh.bin" ? basePayload() : Buffer.alloc(0)),
        ),
    ],
    [
      "incompleteDataUri",
      () =>
        rejects(
          changed(["buffers", 0, "uri"], "data:"),
          "not a complete data URI",
        ),
    ],
    [
      "noncanonicalBase64Length",
      () =>
        rejects(
          dataDocument("data:application/octet-stream;base64,A"),
          "base64 payload is not canonical",
        ),
    ],
    [
      "noncanonicalBase64Alphabet",
      () =>
        rejects(
          dataDocument("data:application/octet-stream;base64,!!!!!!!!!!!!"),
          "base64 payload is not canonical",
        ),
    ],
    [
      "base64LengthMismatch",
      () =>
        rejects(
          dataDocument("data:application/octet-stream;base64,AA=="),
          "data URI has 1 bytes",
        ),
    ],
    [
      "invalidPercentEscape",
      () =>
        rejects(
          dataDocument("data:application/octet-stream,%0"),
          "percent escape is incomplete",
        ),
    ],
    [
      "validBase64Data",
      () =>
        accepts(
          dataDocument(
            `data:application/octet-stream;base64,${basePayload().toString("base64")}`,
          ),
        ),
    ],
    [
      "validPercentData",
      () =>
        accepts(
          dataDocument(
            "data:application/octet-stream,%00%00%00%00%00%00%00%00%00%00%00%00",
          ),
        ),
    ],
    [
      "validRawData",
      () => accepts(dataDocument("data:application/octet-stream,abcdefghijkl")),
    ],
    [
      "embeddedImageData",
      () =>
        accepts(changed(["images"], [{ uri: "data:image/png;base64,AQ==" }])),
    ],
    [
      "embeddedImageBufferView",
      () => accepts(changed(["images"], [{ bufferView: 0 }])),
    ],
    [
      "bufferViewMustFitBuffer",
      () =>
        rejects(
          changed(["bufferViews", 0, "byteLength"], 16),
          "exceeds buffers[0]",
        ),
    ],
    [
      "staticProfileNeedsMesh",
      () => rejects(withoutMesh(), "has no mesh to render or review"),
    ],
    [
      "staticProfileLeavesAnimationForItsLoader",
      () => inspect(changed(["animations"], [{}])).motion === undefined,
    ],
    [
      "glbNeedsBin",
      () => rejectsGlb(embeddedDocument(), null, "has no BIN chunk"),
    ],
    [
      "glbBinAllowsPadding",
      () => acceptsGlb(embeddedDocument(9), Buffer.alloc(12)),
    ],
    [
      "glbBinMustCoverDeclaredLength",
      () =>
        rejectsGlb(embeddedDocument(13), Buffer.alloc(12), "does not cover"),
    ],
    [
      "glbBinPaddingIsBounded",
      () => rejectsGlb(embeddedDocument(8), Buffer.alloc(12), "does not cover"),
    ],
    [
      "glbBinNeedsBuffer",
      () =>
        rejectsGlb(
          { asset: { version: "2.0" }, nodes: [] },
          Buffer.alloc(4),
          "declares no buffer",
        ),
    ],
    [
      "glbBinCannotBeOrphaned",
      () =>
        rejectsGlb(
          baseDocument(),
          Buffer.alloc(12),
          "BIN chunk is orphaned",
          resolveOnlyBuffer,
        ),
    ],
    [
      "glbSecondBufferCannotUseBin",
      () =>
        rejectsGlb(
          secondEmbeddedBuffer(),
          Buffer.alloc(12),
          "cannot use the GLB BIN chunk",
        ),
    ],
    ["validSparseAccessor", () => accepts(sparseDocument())],
    [
      "sparseCountCannotExceedAccessor",
      () =>
        rejects(
          set(sparseDocument(), ["accessors", 0, "sparse", "count"], 2),
          "sparse.count exceeds",
        ),
    ],
    [
      "sparseIndicesMustBeObject",
      () =>
        rejects(
          set(sparseDocument(), ["accessors", 0, "sparse", "indices"], null),
          "sparse.indices must be an object",
        ),
    ],
    [
      "sparseValuesMustBeObject",
      () =>
        rejects(
          set(sparseDocument(), ["accessors", 0, "sparse", "values"], null),
          "sparse.values must be an object",
        ),
    ],
    [
      "sparseIndexTypeMustBeUnsigned",
      () =>
        rejects(
          set(
            sparseDocument(),
            ["accessors", 0, "sparse", "indices", "componentType"],
            5122,
          ),
          "must be unsigned byte",
        ),
    ],
    [
      "sparseIndexRangeMustFit",
      () =>
        rejects(
          set(
            sparseDocument(),
            ["accessors", 0, "sparse", "indices", "byteOffset"],
            12,
          ),
          "indices exceeds its bufferView",
        ),
    ],
    [
      "sparseValueRangeMustFit",
      () =>
        rejects(
          set(
            sparseDocument(),
            ["accessors", 0, "sparse", "values", "byteOffset"],
            4,
          ),
          "values exceeds its bufferView",
        ),
    ],
    [
      "matrixPaddingShapes",
      () => accepts(matrixDocument(), () => Buffer.alloc(56)),
    ],
    [
      "humanoidNeedsHips",
      () =>
        rejects(
          humanoidChanged(["nodes", 1, "name"], "Spine"),
          "requires a skin and a normalized hips",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "skinBindingNeedsMesh",
      () =>
        rejects(
          humanoidChanged(["nodes", 0, "mesh"], undefined),
          "binds a skin without a render mesh",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "humanoidNeedsBoundPrimitive",
      () =>
        rejects(
          humanoidChanged(["nodes", 0, "skin"], undefined),
          "complete skin binding",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "humanoidNeedsJointAttribute",
      () =>
        rejects(
          humanoidChanged(
            ["meshes", 0, "primitives", 0, "attributes", "JOINTS_0"],
            undefined,
          ),
          "attributes.JOINTS_0",
          "gltf-humanoid-v1",
        ),
    ],
    [
      "humanoidNeedsWeightAttribute",
      () =>
        rejects(
          humanoidChanged(
            ["meshes", 0, "primitives", 0, "attributes", "WEIGHTS_0"],
            undefined,
          ),
          "attributes.WEIGHTS_0",
          "gltf-humanoid-v1",
        ),
    ],
    ...humanoidShapeFailures(),
    [
      "humanoidJointMustStayInsideSkin",
      () =>
        rejectsHumanoidPayload((payload) => {
          payload[36] = 1;
        }, "cites joint 1 outside skin"),
    ],
    [
      "humanoidNeedsPositiveWeight",
      () =>
        rejectsHumanoidPayload(
          (payload) => payload.fill(0, 48, 60),
          "has no positive skin weight",
        ),
    ],
    [
      "skinAccessorCannotBeSparse",
      () =>
        rejects(
          humanoidChanged(["accessors", 1, "sparse"], {
            count: 1,
            indices: { bufferView: 1, componentType: 5121 },
            values: { bufferView: 1 },
          }),
          "Skin accessor 1 may not use sparse overrides",
          "gltf-humanoid-v1",
        ),
    ],
    ["humanoidU16Accessors", () => acceptsHumanoid(unsignedShortHumanoid())],
    ["humanoidFloatWeights", () => acceptsHumanoid(floatWeightHumanoid())],
    [
      "humanoidNormalizedFloatWeights",
      () => acceptsHumanoid(normalizedFloatWeightHumanoid()),
    ],
    ["humanoidOffsetDefaults", () => acceptsHumanoid(offsetHumanoid())],
    ["humanoidIgnoresUnmappedAliases", () => acceptsHumanoid(aliasHumanoid())],
    [
      "pathWithoutExtension",
      () =>
        throwsError(
          () =>
            inspectAutoMovieExternalModelBytes({
              path: "public/models/matrix",
              bytes: Buffer.from(JSON.stringify(baseDocument()), "utf8"),
              profile: "gltf-static-v1",
            }),
          "must end in .gltf, .glb, or .vrm",
        ),
    ],
    ...vrmFacts(),
  ];

  TestValidator.equals(
    "external model validation facts",
    namedFacts(facts),
    Object.fromEntries(facts.map(([name]) => [name, true])),
  );
};

const baseDocument = (): JsonObject => ({
  asset: { version: "2.0" },
  buffers: [{ byteLength: 12, uri: "mesh.bin" }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: "VEC3" }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ mesh: 0 }],
  scenes: [{ nodes: [0] }],
});

const basePayload = (): Buffer => Buffer.alloc(12);

const changed = (path: Path, value: unknown): JsonObject =>
  set(baseDocument(), path, value);

const set = (document: JsonObject, path: Path, value: unknown): JsonObject => {
  let cursor: unknown = document;
  for (const part of path.slice(0, -1))
    cursor = Array.isArray(cursor)
      ? cursor[part as number]
      : (cursor as JsonObject)[part];
  const last = path[path.length - 1]!;
  if (Array.isArray(cursor)) cursor[last as number] = value;
  else (cursor as JsonObject)[last] = value;
  return document;
};

const inspect = (
  document: unknown,
  profile = "gltf-static-v1",
  resolver: (uri: string) => Uint8Array | null = resolveOnlyBuffer,
) =>
  inspectAutoMovieExternalModelBytes({
    path: "public/models/matrix.gltf",
    bytes: Buffer.from(JSON.stringify(document), "utf8"),
    profile,
    resolveResource: resolver,
  });

const accepts = (
  document: unknown,
  resolver: (uri: string) => Uint8Array | null = resolveOnlyBuffer,
): boolean => {
  inspect(document, "gltf-static-v1", resolver);
  return true;
};

const rejects = (
  document: unknown,
  message: string,
  profile = "gltf-static-v1",
  resolver?: (uri: string) => Uint8Array | null,
): boolean =>
  throwsError(
    () =>
      inspect(
        document,
        profile,
        resolver ??
          (profile === "gltf-humanoid-v1"
            ? humanoidResolver
            : resolveOnlyBuffer),
      ),
    message,
  );

const resolveOnlyBuffer = (uri: string): Uint8Array | null =>
  uri === "mesh.bin" ? basePayload() : null;

const dataDocument = (uri: string): JsonObject =>
  changed(["buffers", 0, "uri"], uri);

const conflictingBuffers = (): JsonObject => {
  const document = baseDocument();
  document.buffers = [
    { byteLength: 12, uri: "mesh.bin" },
    { byteLength: 16, uri: "mesh.bin" },
  ];
  return document;
};

const withoutMesh = (): JsonObject => {
  const document = baseDocument();
  document.meshes = [];
  document.nodes = [];
  document.scenes = [];
  return document;
};

const embeddedDocument = (byteLength = 12): JsonObject => {
  const document = baseDocument();
  document.buffers = [{ byteLength }];
  document.bufferViews = [{ buffer: 0, byteLength: 4 }];
  document.accessors = [
    { bufferView: 0, componentType: 5126, count: 1, type: "SCALAR" },
  ];
  return document;
};

const secondEmbeddedBuffer = (): JsonObject => {
  const document = embeddedDocument();
  document.buffers = [{ byteLength: 12 }, { byteLength: 4 }];
  return document;
};

const glb = (document: unknown, bin: Buffer | null): Buffer => {
  const source = Buffer.from(JSON.stringify(document), "utf8");
  const jsonPadding = (4 - (source.length % 4)) % 4;
  const json = Buffer.concat([source, Buffer.alloc(jsonPadding, 0x20)]);
  const total = 20 + json.length + (bin === null ? 0 : 8 + bin.length);
  const output = Buffer.alloc(total);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(total, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  json.copy(output, 20);
  if (bin !== null) {
    output.writeUInt32LE(bin.length, 20 + json.length);
    output.writeUInt32LE(0x004e4942, 24 + json.length);
    bin.copy(output, 28 + json.length);
  }
  return output;
};

const inspectGlb = (
  document: unknown,
  bin: Buffer | null,
  resolver?: (uri: string) => Uint8Array | null,
) =>
  inspectAutoMovieExternalModelBytes({
    path: "public/models/matrix.glb",
    bytes: glb(document, bin),
    profile: "gltf-static-v1",
    resolveResource: resolver,
  });

const acceptsGlb = (document: unknown, bin: Buffer | null): boolean => {
  inspectGlb(document, bin);
  return true;
};

const rejectsGlb = (
  document: unknown,
  bin: Buffer | null,
  message: string,
  resolver?: (uri: string) => Uint8Array | null,
): boolean => throwsError(() => inspectGlb(document, bin, resolver), message);

const sparseDocument = (): JsonObject => {
  const document = baseDocument();
  document.bufferViews = [
    { buffer: 0, byteOffset: 0, byteLength: 12 },
    { buffer: 0, byteOffset: 0, byteLength: 12 },
  ];
  document.accessors = [
    {
      componentType: 5126,
      count: 1,
      type: "VEC3",
      sparse: {
        count: 1,
        indices: { bufferView: 0, componentType: 5121 },
        values: { bufferView: 1 },
      },
    },
  ];
  return document;
};

const matrixDocument = (): JsonObject => {
  const document = baseDocument();
  document.buffers = [{ byteLength: 56, uri: "matrix.bin" }];
  document.bufferViews = [
    { buffer: 0, byteOffset: 0, byteLength: 12 },
    { buffer: 0, byteOffset: 12, byteLength: 8 },
    { buffer: 0, byteOffset: 20, byteLength: 12 },
    { buffer: 0, byteOffset: 32, byteLength: 24 },
  ];
  document.accessors = [
    { bufferView: 0, componentType: 5126, count: 1, type: "VEC3" },
    { bufferView: 1, componentType: 5121, count: 1, type: "MAT2" },
    { bufferView: 2, componentType: 5121, count: 1, type: "MAT3" },
    { bufferView: 3, componentType: 5123, count: 1, type: "MAT3" },
  ];
  return document;
};

const humanoidDocument = (): JsonObject => ({
  asset: { version: "2.0" },
  buffers: [{ byteLength: 60, uri: "human.bin" }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 12 },
    { buffer: 0, byteOffset: 48, byteLength: 12 },
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
  ],
  meshes: [
    {
      primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }],
    },
  ],
  nodes: [{ mesh: 0, skin: 0 }, { name: "Hips" }],
  skins: [{ joints: [1] }],
  scenes: [{ nodes: [0, 1] }],
});

const humanoidPayload = (): Buffer => {
  const payload = Buffer.alloc(60);
  for (let vertex = 0; vertex < 3; ++vertex) payload[48 + vertex * 4] = 255;
  return payload;
};

const humanoidResolver = (uri: string): Uint8Array | null =>
  uri === "human.bin" ? humanoidPayload() : null;

const humanoidChanged = (path: Path, value: unknown): JsonObject =>
  set(humanoidDocument(), path, value);

const rejectsHumanoidPayload = (
  mutate: (payload: Buffer) => void,
  message: string,
): boolean => {
  const payload = humanoidPayload();
  mutate(payload);
  return rejects(humanoidDocument(), message, "gltf-humanoid-v1", (uri) =>
    uri === "human.bin" ? payload : null,
  );
};

const humanoidShapeFailures = (): [string, () => boolean][] =>
  [
    ["jointShape", ["accessors", 1, "type"], "VEC3"],
    ["jointComponent", ["accessors", 1, "componentType"], 5120],
    ["weightShape", ["accessors", 2, "type"], "VEC3"],
    ["weightComponent", ["accessors", 2, "componentType"], 5120],
    ["weightU8MustNormalize", ["accessors", 2, "normalized"], false],
    ["jointCount", ["accessors", 1, "count"], 2],
    ["weightCount", ["accessors", 2, "count"], 2],
  ].map(([name, path, value]) => [
    `humanoid${name}`,
    () =>
      rejects(
        humanoidChanged(path as Path, value),
        "count-matched JOINTS_0 and normalized WEIGHTS_0",
        "gltf-humanoid-v1",
        humanoidResolver,
      ),
  ]);

const acceptsHumanoid = (fixture: {
  document: JsonObject;
  payload: Buffer;
}): boolean => {
  inspect(fixture.document, "gltf-humanoid-v1", (uri) =>
    uri === "human.bin" ? fixture.payload : null,
  );
  return true;
};

const unsignedShortHumanoid = (): { document: JsonObject; payload: Buffer } => {
  const document = humanoidDocument();
  document.buffers = [{ byteLength: 84, uri: "human.bin" }];
  document.bufferViews = [
    { buffer: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 24 },
    { buffer: 0, byteOffset: 60, byteLength: 24 },
  ];
  set(document, ["accessors", 1, "componentType"], 5123);
  set(document, ["accessors", 2, "componentType"], 5123);
  const payload = Buffer.alloc(84);
  for (let vertex = 0; vertex < 3; ++vertex)
    payload.writeUInt16LE(65535, 60 + vertex * 8);
  return { document, payload };
};

const floatWeightHumanoid = (): { document: JsonObject; payload: Buffer } => {
  const document = humanoidDocument();
  document.buffers = [{ byteLength: 96, uri: "human.bin" }];
  document.bufferViews = [
    { buffer: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 12 },
    { buffer: 0, byteOffset: 48, byteLength: 48 },
  ];
  set(document, ["accessors", 2, "componentType"], 5126);
  set(document, ["accessors", 2, "normalized"], false);
  const payload = Buffer.alloc(96);
  for (let vertex = 0; vertex < 3; ++vertex)
    payload.writeFloatLE(1, 48 + vertex * 16);
  return { document, payload };
};

const normalizedFloatWeightHumanoid = (): {
  document: JsonObject;
  payload: Buffer;
} => {
  const fixture = floatWeightHumanoid();
  set(fixture.document, ["accessors", 2, "normalized"], true);
  return fixture;
};

const offsetHumanoid = (): { document: JsonObject; payload: Buffer } => {
  const fixture = unsignedShortHumanoid();
  set(fixture.document, ["bufferViews", 1, "byteOffset"], undefined);
  set(fixture.document, ["accessors", 1, "byteOffset"], 0);
  set(fixture.document, ["accessors", 2, "byteOffset"], 0);
  return fixture;
};

const aliasHumanoid = (): { document: JsonObject; payload: Buffer } => {
  const document = humanoidDocument();
  document.nodes = [
    { mesh: 0, skin: 0 },
    { name: "Hips" },
    {},
    { name: "Pelvis" },
  ];
  set(document, ["skins", 0, "joints"], [1, 2, 3]);
  return { document, payload: humanoidPayload() };
};

const vrmFacts = (): [string, () => boolean][] => {
  const inspectVrm = (document: JsonObject): unknown =>
    inspectAutoMovieExternalModelBytes({
      path: "public/models/human.vrm",
      bytes: glb(document, null),
      profile: "vrm-humanoid-v1",
      resolveResource: humanoidResolver,
    });
  const vrm1 = (): JsonObject => {
    const document = humanoidDocument();
    document.extensions = {
      VRMC_vrm: { humanoid: { humanBones: { hips: { node: 1 } } } },
    };
    return document;
  };
  const vrm0 = (): JsonObject => {
    const document = humanoidDocument();
    document.extensions = {
      VRM: { humanoid: { humanBones: [{ bone: "hips", node: 1 }] } },
    };
    return document;
  };
  return [
    ["vrmOne", () => Boolean(inspectVrm(vrm1()))],
    ["vrmZero", () => Boolean(inspectVrm(vrm0()))],
    [
      "vrmOneUnknownBone",
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm1(),
                ["extensions", "VRMC_vrm", "humanoid", "humanBones", "tail"],
                { node: 1 },
              ),
            ),
          "unknown humanoid bone",
        ),
    ],
    [
      "vrmOneBoneMustBeObject",
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm1(),
                ["extensions", "VRMC_vrm", "humanoid", "humanBones", "hips"],
                null,
              ),
            ),
          "humanBones.hips must be an object",
        ),
    ],
    [
      "vrmOneNodeMustResolve",
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm1(),
                [
                  "extensions",
                  "VRMC_vrm",
                  "humanoid",
                  "humanBones",
                  "hips",
                  "node",
                ],
                9,
              ),
            ),
          "does not resolve to a node",
        ),
    ],
    ...[
      ["vrmOneNodeMustBeNumber", "1"],
      ["vrmOneNodeMustBeSafeInteger", 1.5],
      ["vrmOneNodeMustBeNonnegative", -1],
    ].map(([name, node]): [string, () => boolean] => [
      name as string,
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm1(),
                [
                  "extensions",
                  "VRMC_vrm",
                  "humanoid",
                  "humanBones",
                  "hips",
                  "node",
                ],
                node,
              ),
            ),
          "does not resolve to a node",
        ),
    ]),
    [
      "vrmZeroBoneMustBeString",
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm0(),
                ["extensions", "VRM", "humanoid", "humanBones", 0, "bone"],
                1,
              ),
            ),
          "unknown, duplicate or dangling",
        ),
    ],
    [
      "vrmZeroBoneMustBeKnown",
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm0(),
                ["extensions", "VRM", "humanoid", "humanBones", 0, "bone"],
                "tail",
              ),
            ),
          "unknown, duplicate or dangling",
        ),
    ],
    [
      "vrmZeroNodeMustResolve",
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm0(),
                ["extensions", "VRM", "humanoid", "humanBones", 0, "node"],
                9,
              ),
            ),
          "unknown, duplicate or dangling",
        ),
    ],
    [
      "vrmZeroBoneMustBeUnique",
      () =>
        throwsError(
          () =>
            inspectVrm(
              set(
                vrm0(),
                ["extensions", "VRM", "humanoid", "humanBones"],
                [
                  { bone: "hips", node: 1 },
                  { bone: "hips", node: 1 },
                ],
              ),
            ),
          "unknown, duplicate or dangling",
        ),
    ],
    [
      "vrmMetadataIsRequired",
      () =>
        throwsError(
          () => inspectVrm(humanoidDocument()),
          "requires a GLB/VRM container with VRM",
        ),
    ],
  ];
};
