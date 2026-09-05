import { inspectAutoMovieExternalModelBytes } from "@automovie/ingest";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

/**
 * Motion inspection grounds every semantic mapping in the exact glTF node
 * hierarchy, local rest transforms, and declared spatial interpretation.
 *
 * Scenarios:
 *
 * 1. A valid motion source returns stable node ids, source indices and names,
 *    parent ids, canonical local TRS, and the meter/right-handed/Y-up profile.
 * 2. Out-of-range, multiply parented, and cyclic node hierarchies fail before an
 *    adoption receipt can cite them.
 * 3. Malformed or non-finite TRS, non-positive scale, and non-unit rotation fail
 *    instead of becoming a guessed source rest basis.
 * 4. A node matrix is refused because this profile promises explicit TRS and does
 *    not silently decompose or discard shear.
 * 5. JSON glTF and GLB refuse duplicate object members, including names that
 *    become equal only after JSON escape decoding.
 */
export const test_ingest_external_model_inspector = (): void => {
  const inspected = inspect(motionFixture());
  TestValidator.equals(
    "canonical motion node facts",
    {
      interpretation: inspected.motion?.interpretation,
      nodes: inspected.motion?.nodes,
      nodeIds: inspected.motion?.nodeIds,
    },
    {
      interpretation: "gltf-2.0-meter-right-handed-y-up",
      nodes: [
        {
          id: "node_0",
          index: 0,
          name: null,
          parent: "node_1",
          transform: {
            translation: { x: 0, y: 0.5, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
        },
        {
          id: "node_1",
          index: 1,
          name: null,
          parent: "node_2",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
        },
        {
          id: "node_2",
          index: 2,
          name: "Root",
          parent: null,
          transform: {
            translation: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 2, y: 3, z: 4 },
          },
        },
      ],
      nodeIds: ["node_0", "node_1", "node_2"],
    },
  );

  TestValidator.equals(
    "invalid node facts are refused",
    namedFacts([
      [
        "parentIndexMustResolve",
        () =>
          rejects(
            (nodes) => (nodes[0]!.children = [99]),
            "children[0] does not resolve",
          ),
      ],
      [
        "nodeMustHaveOneParent",
        () =>
          rejects(
            (nodes) => (nodes[0]!.children = [1]),
            "has multiple parents",
          ),
      ],
      [
        "nodeHierarchyMustBeAcyclic",
        () =>
          rejects(
            (nodes) => (nodes[0]!.children = [2]),
            "belongs to a parent cycle",
          ),
      ],
      [
        "nodeMatrixIsRefused",
        () =>
          rejects(
            (nodes) =>
              (nodes[0]!.matrix = [
                1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
              ]),
            ".matrix is unsupported",
          ),
      ],
      [
        "nodeNameMustBeString",
        () =>
          rejects((nodes) => (nodes[1]!.name = 7), ".name must be a string"),
      ],
      [
        "translationMustBeAnArray",
        () =>
          rejects(
            (nodes) => (nodes[0]!.translation = {}),
            "must contain exactly 3 finite numbers",
          ),
      ],
      [
        "translationMustHaveThreeComponents",
        () =>
          rejects(
            (nodes) => (nodes[0]!.translation = [0, 0]),
            "must contain exactly 3 finite numbers",
          ),
      ],
      [
        "translationMustBeFinite",
        () =>
          rejects(
            (nodes) => (nodes[0]!.translation = [0, null, 0]),
            ".translation[1] must be finite",
          ),
      ],
      [
        "scaleMustBePositive",
        () =>
          rejects(
            (nodes) => (nodes[0]!.scale = [1, 0, 1]),
            ".scale must contain only positive values",
          ),
      ],
      [
        "rotationMustBeUnit",
        () =>
          rejects(
            (nodes) => (nodes[0]!.rotation = [0, 0, 0, 2]),
            ".rotation must be a unit quaternion",
          ),
      ],
    ]),
    Object.fromEntries(
      [
        "parentIndexMustResolve",
        "nodeMustHaveOneParent",
        "nodeHierarchyMustBeAcyclic",
        "nodeMatrixIsRefused",
        "nodeNameMustBeString",
        "translationMustBeAnArray",
        "translationMustHaveThreeComponents",
        "translationMustBeFinite",
        "scaleMustBePositive",
        "rotationMustBeUnit",
      ].map((name) => [name, true]),
    ),
  );

  const duplicateFixture = motionFixture();
  const source = JSON.stringify(duplicateFixture.document);
  const rootDuplicate =
    JSON.stringify({ asset: { version: "1.0" } }).slice(0, -1) +
    `,${source.slice(1)}`;
  const escapedDuplicate = source.replace(
    '"asset":',
    '"\\u0061sset":{"version":"1.0"},"asset":',
  );
  const nestedDuplicate = source.replace(
    '"asset":',
    '"extras":{"owner":"left","owner":"right"},"asset":',
  );
  const arrayElementDuplicate = source.replace(
    '"asset":',
    '"extras":{"list":[1,{"k":1,"k":2}]},"asset":',
  );
  const trickyStrings = source.replace(
    '"asset":',
    '"extras":{"note":"{\\"a\\":[1,{\\"b\\":2}]}","q\\"uote":"]}","\\u007b":" , "},"asset":',
  );
  TestValidator.equals(
    "decoded duplicate members are refused in JSON glTF and GLB",
    namedFacts([
      [
        "jsonRootDuplicate",
        () =>
          throwsError(
            () => inspectSource(rootDuplicate, "public/motion/duplicate.gltf"),
            'duplicate member "asset"',
          ),
      ],
      [
        "jsonSyntax",
        () =>
          throwsError(
            () => inspectSource('{"asset":', "public/motion/invalid.gltf"),
            "External model JSON is invalid",
          ),
      ],
      [
        "jsonWhitespace",
        () => {
          inspectSource(` \n${source}\n`, "public/motion/whitespace.gltf");
          return true;
        },
      ],
      [
        "jsonEscapedDuplicate",
        () =>
          throwsError(
            () => inspectSource(escapedDuplicate, "public/motion/escaped.gltf"),
            'duplicate member "asset"',
          ),
      ],
      [
        "jsonNestedDuplicate",
        () =>
          throwsError(
            () => inspectSource(nestedDuplicate, "public/motion/nested.gltf"),
            'duplicate member "owner"',
          ),
      ],
      [
        "jsonArrayElementDuplicate",
        () =>
          throwsError(
            () =>
              inspectSource(arrayElementDuplicate, "public/motion/array.gltf"),
            'duplicate member "k"',
          ),
      ],
      [
        "jsonBracesAndEscapesInsideStringsAreNotStructure",
        () => {
          inspectSource(trickyStrings, "public/motion/tricky.gltf");
          return true;
        },
      ],
      [
        "glbRootDuplicate",
        () =>
          throwsError(
            () =>
              inspectSource(
                motionGlb(rootDuplicate),
                "public/motion/duplicate.glb",
              ),
            'duplicate member "asset"',
          ),
      ],
    ]),
    {
      glbRootDuplicate: true,
      jsonArrayElementDuplicate: true,
      jsonBracesAndEscapesInsideStringsAreNotStructure: true,
      jsonEscapedDuplicate: true,
      jsonNestedDuplicate: true,
      jsonRootDuplicate: true,
      jsonSyntax: true,
      jsonWhitespace: true,
    },
  );
};

type MotionDocument = ReturnType<typeof motionDocument>;
type MotionNode = Record<string, unknown>;

const inspect = (fixture: ReturnType<typeof motionFixture>) =>
  inspectSource(fixture.bytes, "public/motion/grounded.gltf", fixture.payload);

const inspectSource = (
  bytes: Uint8Array | string,
  path: string,
  payload: Uint8Array = motionFixture().payload,
) =>
  inspectAutoMovieExternalModelBytes({
    path,
    bytes: typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes,
    profile: "gltf-motion-v1",
    resolveResource: (uri) => (uri === "grounded.bin" ? payload : null),
  });

const motionGlb = (source: string): Uint8Array => {
  const json = Buffer.from(source, "utf8");
  const padding = (4 - (json.length % 4)) % 4;
  const output = Buffer.alloc(20 + json.length + padding, 0x20);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length + padding, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  json.copy(output, 20);
  return output;
};

const rejects = (
  mutate: (nodes: MotionNode[]) => void,
  message: string,
): boolean => {
  const document = motionDocument();
  mutate(document.nodes as MotionNode[]);
  return throwsError(() => inspect(motionFixture(document)), message);
};

const motionFixture = (document: MotionDocument = motionDocument()) => {
  const payload = Buffer.from(
    new Float32Array([0, 1, 0, 0, 0, 1, 0, 0, 0, 1]).buffer,
  );
  document.buffers[0]!.byteLength = payload.byteLength;
  return {
    document,
    bytes: Buffer.from(JSON.stringify(document), "utf8"),
    payload,
  };
};

const motionDocument = () => ({
  asset: { version: "2.0" },
  extensionsUsed: [],
  buffers: [{ byteLength: 40, uri: "grounded.bin" }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 8 },
    { buffer: 0, byteOffset: 8, byteLength: 32 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" },
    { bufferView: 1, componentType: 5126, count: 2, type: "VEC4" },
  ],
  nodes: [
    { translation: [0, 0.5, 0], rotation: [0, 0, 0, 0.99999] },
    { name: "", children: [0] },
    {
      name: "Root",
      children: [1],
      translation: [1, 2, 3],
      rotation: [0, 0, 0, 1],
      scale: [2, 3, 4],
    },
  ],
  scenes: [{ nodes: [2] }],
  animations: [
    {
      name: "Grounded",
      samplers: [{ input: 0, output: 1 }],
      channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
    },
  ],
});
