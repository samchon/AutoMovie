/**
 * Byte-level facts accepted by the external-model compiler boundary.
 *
 * This inspection is intentionally synchronous: the production compiler owns
 * exact resident bytes and must reject malformed glTF/GLB/VRM before source
 * materialization. Hosts still use their native loader to construct the final
 * render mesh from the same content-addressed asset.
 */
export interface IAutoMovieExternalModelInspection {
  /** Parsed container family. */
  format: "gltf" | "glb" | "vrm";
  /** GlTF asset version. */
  version: "2.0";
  /** Declared scene graph inventory. */
  counts: {
    nodes: number;
    meshes: number;
    skins: number;
    animations: number;
  };
  /** Unique extension identities in code-unit order. */
  extensions: string[];
  /** Unique non-data external buffer/image URIs in code-unit order. */
  externalResources: string[];
}

/** Supported fixed normalization profiles at the compiler ingest boundary. */
export type AutoMovieExternalModelIngestProfile =
  | "gltf-static-v1"
  | "gltf-humanoid-v1"
  | "vrm-humanoid-v1";

/**
 * Parse and validate exact external model bytes before compilation.
 *
 * The inspector accepts glTF 2.0 JSON, GLB 2.0, and VRM 0.x/1.x GLB containers,
 * validates referenced indices and structural profile promises, and returns
 * every sidecar URI the compiler must bind to manifest-owned bytes. It never
 * guesses a profile or repairs malformed input.
 */
export const inspectAutoMovieExternalModelBytes = (props: {
  path: string;
  bytes: Uint8Array;
  profile: string;
}): IAutoMovieExternalModelInspection => {
  if (!SUPPORTED_PROFILES.has(props.profile))
    throw new Error(
      `Unsupported external-model ingest profile "${props.profile}".`,
    );
  const extension = fileExtension(props.path);
  const parsed =
    extension === ".gltf"
      ? { json: decodeJson(props.bytes), format: "gltf" as const }
      : extension === ".glb" || extension === ".vrm"
        ? decodeGlb(props.bytes, extension === ".vrm")
        : (() => {
            throw new Error(
              `External model "${props.path}" must end in .gltf, .glb, or .vrm.`,
            );
          })();
  const document = object(parsed.json, "glTF root");
  const asset = object(document.asset, "glTF asset");
  if (asset.version !== "2.0")
    throw new Error('External models must declare glTF asset.version "2.0".');

  const nodes = optionalArray(document.nodes, "nodes");
  const meshes = optionalArray(document.meshes, "meshes");
  const skins = optionalArray(document.skins, "skins");
  const animations = optionalArray(document.animations, "animations");
  const scenes = optionalArray(document.scenes, "scenes");
  const buffers = optionalArray(document.buffers, "buffers");
  const bufferViews = optionalArray(document.bufferViews, "bufferViews");
  const accessors = optionalArray(document.accessors, "accessors");
  const images = optionalArray(document.images, "images");

  nodes.forEach((value, index) => {
    const node = object(value, `nodes[${index}]`);
    integerIndex(node.mesh, meshes.length, `nodes[${index}].mesh`);
    integerIndex(node.skin, skins.length, `nodes[${index}].skin`);
    integerIndices(node.children, nodes.length, `nodes[${index}].children`);
  });
  scenes.forEach((value, index) =>
    integerIndices(
      object(value, `scenes[${index}]`).nodes,
      nodes.length,
      `scenes[${index}].nodes`,
    ),
  );
  buffers.forEach((value, index) => {
    const buffer = object(value, `buffers[${index}]`);
    positiveInteger(buffer.byteLength, `buffers[${index}].byteLength`);
    if (parsed.format === "gltf" && buffer.uri === undefined)
      throw new Error(
        `buffers[${index}].uri is required by a JSON glTF container.`,
      );
  });
  meshes.forEach((value, meshIndex) => {
    const mesh = object(value, `meshes[${meshIndex}]`);
    const primitives = requiredArray(
      mesh.primitives,
      `meshes[${meshIndex}].primitives`,
    );
    if (primitives.length === 0)
      throw new Error(`meshes[${meshIndex}] has no render primitive.`);
    primitives.forEach((primitiveValue, primitiveIndex) => {
      const primitive = object(
        primitiveValue,
        `meshes[${meshIndex}].primitives[${primitiveIndex}]`,
      );
      const attributes = object(
        primitive.attributes,
        `meshes[${meshIndex}].primitives[${primitiveIndex}].attributes`,
      );
      integerIndex(
        attributes.POSITION,
        accessors.length,
        `meshes[${meshIndex}].primitives[${primitiveIndex}].attributes.POSITION`,
        true,
      );
      integerIndex(
        primitive.indices,
        accessors.length,
        `meshes[${meshIndex}].primitives[${primitiveIndex}].indices`,
      );
    });
  });
  skins.forEach((value, index) => {
    const skin = object(value, `skins[${index}]`);
    const joints = requiredArray(skin.joints, `skins[${index}].joints`);
    if (joints.length === 0) throw new Error(`skins[${index}] has no joints.`);
    integerIndices(joints, nodes.length, `skins[${index}].joints`);
  });
  bufferViews.forEach((value, index) => {
    const view = object(value, `bufferViews[${index}]`);
    integerIndex(
      view.buffer,
      buffers.length,
      `bufferViews[${index}].buffer`,
      true,
    );
    positiveInteger(view.byteLength, `bufferViews[${index}].byteLength`);
  });
  accessors.forEach((value, index) => {
    const accessor = object(value, `accessors[${index}]`);
    integerIndex(
      accessor.bufferView,
      bufferViews.length,
      `accessors[${index}].bufferView`,
    );
    positiveInteger(accessor.count, `accessors[${index}].count`);
    if (
      typeof accessor.componentType !== "number" ||
      [5120, 5121, 5122, 5123, 5125, 5126].includes(accessor.componentType) ===
        false ||
      typeof accessor.type !== "string" ||
      ["SCALAR", "VEC2", "VEC3", "VEC4", "MAT2", "MAT3", "MAT4"].includes(
        accessor.type,
      ) === false
    )
      throw new Error(
        `accessors[${index}] has an unsupported componentType or shape.`,
      );
  });
  images.forEach((value, index) => {
    const image = object(value, `images[${index}]`);
    if (image.uri === undefined)
      integerIndex(
        image.bufferView,
        bufferViews.length,
        `images[${index}].bufferView`,
        true,
      );
  });

  const extensions = uniqueStrings([
    ...optionalStringArray(document.extensionsUsed, "extensionsUsed"),
    ...Object.keys(optionalObject(document.extensions, "extensions")),
  ]);
  const externalResources = uniqueStrings([
    ...buffers.flatMap((value, index) =>
      externalUri(
        object(value, `buffers[${index}]`).uri,
        `buffers[${index}].uri`,
      ),
    ),
    ...images.flatMap((value, index) =>
      externalUri(
        object(value, `images[${index}]`).uri,
        `images[${index}].uri`,
      ),
    ),
  ]);
  if (meshes.length === 0)
    throw new Error("External model has no mesh to render or review.");
  if (
    props.profile === "gltf-humanoid-v1" &&
    (skins.length === 0 || hasHumanoidRoot(nodes, skins) === false)
  )
    throw new Error(
      'Profile "gltf-humanoid-v1" requires a skin and a named hips/pelvis joint.',
    );
  if (
    props.profile === "vrm-humanoid-v1" &&
    (parsed.format === "gltf" ||
      extensions.some((name) => name === "VRM" || name === "VRMC_vrm") ===
        false ||
      skins.length === 0 ||
      hasVrmHumanoidRoot(document, nodes) === false)
  )
    throw new Error(
      'Profile "vrm-humanoid-v1" requires a GLB/VRM container with VRM or VRMC_vrm metadata.',
    );

  return {
    format: extensions.some((name) => name === "VRM" || name === "VRMC_vrm")
      ? "vrm"
      : parsed.format,
    version: "2.0",
    counts: {
      nodes: nodes.length,
      meshes: meshes.length,
      skins: skins.length,
      animations: animations.length,
    },
    extensions,
    externalResources,
  };
};

const SUPPORTED_PROFILES: ReadonlySet<string> =
  new Set<AutoMovieExternalModelIngestProfile>([
    "gltf-static-v1",
    "gltf-humanoid-v1",
    "vrm-humanoid-v1",
  ]);

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;

const decodeGlb = (
  input: Uint8Array,
  vrmExtension: boolean,
): { json: unknown; format: "glb" | "vrm" } => {
  const bytes = new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20)
    throw new Error("GLB/VRM container is shorter than its mandatory header.");
  if (view.getUint32(0, true) !== GLB_MAGIC)
    throw new Error("GLB/VRM container has an invalid magic value.");
  if (view.getUint32(4, true) !== 2)
    throw new Error("Only GLB container version 2 is supported.");
  if (view.getUint32(8, true) !== bytes.length)
    throw new Error("GLB declared length does not match resident bytes.");
  const jsonLength = view.getUint32(12, true);
  if (
    jsonLength === 0 ||
    jsonLength % 4 !== 0 ||
    view.getUint32(16, true) !== GLB_JSON_CHUNK ||
    20 + jsonLength > bytes.length
  )
    throw new Error("GLB first chunk is not one aligned JSON chunk.");
  let cursor = 20 + jsonLength;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length)
      throw new Error("GLB contains a truncated chunk header.");
    const length = view.getUint32(cursor, true);
    if (length % 4 !== 0 || cursor + 8 + length > bytes.length)
      throw new Error("GLB contains an unaligned or truncated chunk.");
    cursor += 8 + length;
  }
  return {
    json: decodeJson(bytes.subarray(20, 20 + jsonLength)),
    format: vrmExtension ? "vrm" : "glb",
  };
};

const decodeJson = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true })
        .decode(bytes)
        .replace(/[\u0000\u0020]+$/u, ""),
    );
  } catch (error) {
    throw new Error(
      `External model JSON is invalid: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
};

const object = (value: unknown, path: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
};

const optionalObject = (
  value: unknown,
  path: string,
): Record<string, unknown> => (value === undefined ? {} : object(value, path));

const requiredArray = (value: unknown, path: string): unknown[] => {
  if (Array.isArray(value) === false)
    throw new Error(`${path} must be an array.`);
  return value;
};

const optionalArray = (value: unknown, path: string): unknown[] =>
  value === undefined ? [] : requiredArray(value, path);

const optionalStringArray = (value: unknown, path: string): string[] =>
  optionalArray(value, path).map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0)
      throw new Error(`${path}[${index}] must be a non-blank string.`);
    return entry;
  });

const integerIndex = (
  value: unknown,
  length: number,
  path: string,
  required = false,
): void => {
  if (value === undefined && required === false) return;
  if (
    typeof value !== "number" ||
    Number.isSafeInteger(value) === false ||
    value < 0 ||
    value >= length
  )
    throw new Error(`${path} does not resolve inside its declared inventory.`);
};

const integerIndices = (value: unknown, length: number, path: string): void => {
  if (value === undefined) return;
  requiredArray(value, path).forEach((entry, index) =>
    integerIndex(entry, length, `${path}[${index}]`, true),
  );
};

const positiveInteger = (value: unknown, path: string): void => {
  if (
    typeof value !== "number" ||
    Number.isSafeInteger(value) === false ||
    value <= 0
  )
    throw new Error(`${path} must be a positive safe integer.`);
};

const externalUri = (value: unknown, path: string): string[] => {
  if (value === undefined) return [];
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${path} must be a non-empty URI string.`);
  return value.startsWith("data:") ? [] : [value];
};

const uniqueStrings = (values: string[]): string[] =>
  [...new Set(values)].sort(compareCodeUnits);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const fileExtension = (value: string): string => {
  const name = value.slice(value.lastIndexOf("/") + 1);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
};

const hasHumanoidRoot = (nodes: unknown[], skins: unknown[]): boolean => {
  const joints = new Set(
    skins.flatMap((value, index) =>
      requiredArray(
        object(value, `skins[${index}]`).joints,
        `skins[${index}].joints`,
      ),
    ),
  );
  return nodes.some((value, index) => {
    if (joints.has(index) === false) return false;
    const name = object(value, `nodes[${index}]`).name;
    return (
      typeof name === "string" &&
      ["hips", "pelvis"].includes(
        name
          .toLowerCase()
          .replace(/^mixamorig:?/u, "")
          .replace(/[\s_.:|-]/gu, ""),
      )
    );
  });
};

const hasVrmHumanoidRoot = (
  document: Record<string, unknown>,
  nodes: unknown[],
): boolean => {
  const extensions = optionalObject(document.extensions, "extensions");
  if (extensions.VRMC_vrm !== undefined) {
    const vrm = object(extensions.VRMC_vrm, "extensions.VRMC_vrm");
    const humanoid = object(vrm.humanoid, "extensions.VRMC_vrm.humanoid");
    const bones = object(
      humanoid.humanBones,
      "extensions.VRMC_vrm.humanoid.humanBones",
    );
    const hips = object(
      bones.hips,
      "extensions.VRMC_vrm.humanoid.humanBones.hips",
    );
    return validNodeIndex(hips.node, nodes.length);
  }
  if (extensions.VRM !== undefined) {
    const vrm = object(extensions.VRM, "extensions.VRM");
    const humanoid = object(vrm.humanoid, "extensions.VRM.humanoid");
    return requiredArray(
      humanoid.humanBones,
      "extensions.VRM.humanoid.humanBones",
    ).some((value, index) => {
      const bone = object(
        value,
        `extensions.VRM.humanoid.humanBones[${index}]`,
      );
      return bone.bone === "hips" && validNodeIndex(bone.node, nodes.length);
    });
  }
  return false;
};

const validNodeIndex = (value: unknown, length: number): boolean =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value < length;
