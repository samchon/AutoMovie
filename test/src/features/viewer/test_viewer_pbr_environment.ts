import { validateModel } from "@automovie/engine";
import {
  IAutoMovieMaterial,
  IAutoMovieSceneEnvironment,
  IAutoMovieTextureReference,
} from "@automovie/interface";
import {
  applyRenderMode,
  applyRendererEnvironment,
  applySceneEnvironment,
  buildGeometry,
  buildLight,
  buildMaterial,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { createModel } from "../internal/fixtures";
import { hasViolation, namedFacts, nclose } from "../internal/predicates";

const reference = (
  asset: string,
  colorSpace: "srgb" | "linear",
  wrapS: NonNullable<IAutoMovieTextureReference["sampler"]>["wrapS"],
  minFilter: NonNullable<IAutoMovieTextureReference["sampler"]>["minFilter"],
): IAutoMovieTextureReference => ({
  asset,
  texCoord: 0,
  colorSpace,
  transform: {
    offset: { x: 0.25, y: -0.5 },
    scale: { x: 2, y: 3 },
    rotationDeg: 90,
  },
  sampler: {
    wrapS,
    wrapT: "mirror",
    minFilter,
    magFilter: "nearest",
  },
});

const ENVIRONMENT: IAutoMovieSceneEnvironment = {
  image: "studio.hdr",
  background: null,
  intensity: 0.75,
  rotationDeg: 90,
  exposure: 1.25,
  toneMapping: "acesFilmic",
  shadows: { enabled: true, type: "pcfSoft" },
};

const validateMaterial = (patch: Record<string, unknown>) => {
  const model = createModel();
  return validateModel({
    model: {
      ...model,
      materials: [
        {
          ...model.materials[0]!,
          ...patch,
        } as IAutoMovieMaterial,
      ],
    },
  });
};

const materialRefusedAt = (
  patch: Record<string, unknown>,
  kind: "type" | "range",
  path: string,
): boolean => hasViolation(validateMaterial(patch), kind, path);

/**
 * A declared PBR finish and render environment reach Three.js unchanged, and a
 * malformed one never reaches it at all.
 *
 * Scenarios:
 *
 * 1. A material declaring all five maps, a UV transform, a sampler, alpha coverage
 *    and the physical lobes lowers every one of them onto
 *    `MeshPhysicalMaterial`, and the legacy shapes beside it (a bare asset id,
 *    an unresolvable binding, no resolver at all, omitted `alphaMode`, omitted
 *    cutoff) keep the output they had before textures existed.
 * 2. Every malformed binding, sampler value, UV set, transform component and
 *    contradictory alpha/transmission pairing is refused by `validateModel` at
 *    the authored path, while the one-away twins that must NOT fire (a negative
 *    normal scale, opaque transmission, legacy opacity blending) stay valid.
 * 3. Generated geometry uploads exactly one UV set, the only set a binding's
 *    `texCoord` may address.
 * 4. Image lighting mounts as both environment and background, decodes on the
 *    image's own storage (8-bit sRGB, float linear), is suspended and restored
 *    exactly by a structural pass, and falls back to a solid or transparent
 *    background when no image resolves.
 * 5. The renderer's curve, exposure and shadow policy follow the declared
 *    precedence: a scene environment owns them, the delivery curve applies only
 *    where no environment does, a structural pass bypasses both, a shadowless
 *    scene turns a shadow-casting host off, and every apply restores
 *    idempotently.
 * 6. A light's shadow settings reach its shadow camera and map, and a light that
 *    declares none stays at the legacy no-shadow default.
 */
export const test_viewer_pbr_environment = (): void => {
  const base = createModel().materials[0]!;
  const material: IAutoMovieMaterial = {
    ...base,
    baseColorTexture: reference("base.png", "srgb", "clamp", "nearest"),
    metallicRoughnessTexture: reference(
      "metal.png",
      "linear",
      "repeat",
      "linear",
    ),
    normalTexture: reference(
      "normal.png",
      "linear",
      "mirror",
      "nearestMipmapLinear",
    ),
    normalScale: 0.6,
    occlusionTexture: reference(
      "ao.png",
      "linear",
      "clamp",
      "linearMipmapLinear",
    ),
    occlusionStrength: 0.4,
    emissiveTexture: { asset: "emissive.png", texCoord: 0, colorSpace: "srgb" },
    emissive: null,
    opacity: 0.8,
    alphaMode: "mask",
    alphaCutoff: 0.3,
    doubleSided: true,
    transmission: 0.7,
    ior: 1.4,
    thickness: 0.02,
    clearcoat: 0.5,
  };
  const resolved: string[] = [];
  const built = buildMaterial(material, (binding) => {
    resolved.push(typeof binding === "string" ? binding : binding.asset);
    return new THREE.Texture();
  }) as THREE.MeshPhysicalMaterial;
  TestValidator.equals(
    "every PBR map and physical coefficient reaches Three.js",
    namedFacts([
      ["fiveAssets", () => resolved.length === 5],
      ["baseSrgb", () => built.map?.colorSpace === THREE.SRGBColorSpace],
      ["metalShared", () => built.metalnessMap === built.roughnessMap],
      [
        "normal",
        () => built.normalMap !== null && nclose(built.normalScale.x, 0.6),
      ],
      ["ao", () => built.aoMap !== null && nclose(built.aoMapIntensity, 0.4)],
      ["emissive", () => built.emissiveMap !== null && built.emissive.r === 1],
      ["mask", () => !built.transparent && nclose(built.alphaTest, 0.3)],
      ["maskDepth", () => built.depthWrite],
      ["double", () => built.side === THREE.DoubleSide],
      [
        "physical",
        () =>
          nclose(built.transmission, 0.7) &&
          nclose(built.ior, 1.4) &&
          nclose(built.thickness, 0.02) &&
          nclose(built.clearcoat, 0.5),
      ],
      [
        "transform",
        () =>
          built.map?.offset.x === 0.25 &&
          built.map.repeat.y === 3 &&
          nclose(built.map.rotation, Math.PI / 2),
      ],
      [
        "sampler",
        () =>
          built.map?.wrapS === THREE.ClampToEdgeWrapping &&
          built.map.wrapT === THREE.MirroredRepeatWrapping &&
          built.map.minFilter === THREE.NearestFilter &&
          built.map.magFilter === THREE.NearestFilter,
      ],
      ["repeat", () => built.metalnessMap?.wrapS === THREE.RepeatWrapping],
      ["mirror", () => built.normalMap?.wrapS === THREE.MirroredRepeatWrapping],
      [
        "mipmapNearest",
        () => built.normalMap?.minFilter === THREE.NearestMipmapLinearFilter,
      ],
      [
        "mipmapLinear",
        () => built.aoMap?.minFilter === THREE.LinearMipmapLinearFilter,
      ],
    ]),
    {
      fiveAssets: true,
      baseSrgb: true,
      metalShared: true,
      normal: true,
      ao: true,
      emissive: true,
      mask: true,
      maskDepth: true,
      double: true,
      physical: true,
      transform: true,
      sampler: true,
      repeat: true,
      mirror: true,
      mipmapNearest: true,
      mipmapLinear: true,
    },
  );
  const unresolved = buildMaterial({ ...base, baseColorTexture: "base.png" });
  TestValidator.equals(
    "legacy material and unresolved texture preserve the no-map path",
    { mapped: unresolved.map !== null, transparent: unresolved.transparent },
    { mapped: false, transparent: false },
  );
  const missing = buildMaterial(
    { ...base, baseColorTexture: "missing.png" },
    () => undefined,
  );
  TestValidator.equals(
    "missing resolver result remains no-map",
    missing.map,
    null,
  );
  const legacyTexture = buildMaterial(
    { ...base, baseColorTexture: "legacy.png" },
    () => new THREE.Texture(),
  );
  TestValidator.equals(
    "legacy base texture derives the slot color space",
    legacyTexture.map?.colorSpace,
    THREE.SRGBColorSpace,
  );
  const emissive = buildMaterial({
    ...base,
    emissive: { r: 0.2, g: 0.3, b: 0.4, a: null, hex: null },
  });
  TestValidator.predicate(
    "flat emissive color is preserved",
    nclose(emissive.emissive.g, 0.3),
  );
  const blend = buildMaterial({ ...base, opacity: 0.5, alphaMode: "blend" });
  TestValidator.equals(
    "blend mode enables blending without writing opaque depth",
    { transparent: blend.transparent, depthWrite: blend.depthWrite },
    { transparent: true, depthWrite: false },
  );
  const legacyBlend = buildMaterial({ ...base, opacity: 0.5 });
  TestValidator.equals(
    "omitted alpha mode preserves legacy opacity blending",
    {
      transparent: legacyBlend.transparent,
      depthWrite: legacyBlend.depthWrite,
    },
    { transparent: true, depthWrite: false },
  );
  const defaultMask = buildMaterial({ ...base, alphaMode: "mask" });
  TestValidator.equals(
    "mask cutoff has a stable default",
    defaultMask.alphaTest,
    0.5,
  );
  const linearMagnification = buildMaterial(
    {
      ...base,
      baseColorTexture: {
        asset: "linear-mag.png",
        texCoord: 0,
        colorSpace: "srgb",
        sampler: {
          wrapS: "clamp",
          wrapT: "clamp",
          minFilter: "linear",
          magFilter: "linear",
        },
      },
    },
    () => new THREE.Texture(),
  );
  TestValidator.equals(
    "linear magnification maps exactly",
    linearMagnification.map?.magFilter,
    THREE.LinearFilter,
  );

  TestValidator.equals(
    "PBR declarations reject malformed bindings and contradictory states",
    namedFacts([
      [
        "blankLegacy",
        () =>
          materialRefusedAt(
            { baseColorTexture: " " },
            "type",
            ".baseColorTexture",
          ),
      ],
      [
        "bindingType",
        () =>
          materialRefusedAt(
            { baseColorTexture: [] },
            "type",
            ".baseColorTexture",
          ),
      ],
      [
        "asset",
        () =>
          materialRefusedAt(
            {
              baseColorTexture: { asset: " ", texCoord: 0, colorSpace: "srgb" },
            },
            "type",
            ".baseColorTexture.asset",
          ),
      ],
      [
        "uvSet",
        () =>
          materialRefusedAt(
            {
              baseColorTexture: {
                asset: "base.png",
                texCoord: 1,
                colorSpace: "srgb",
              },
            },
            "range",
            ".baseColorTexture.texCoord",
          ),
      ],
      [
        "baseColorSpace",
        () =>
          materialRefusedAt(
            {
              baseColorTexture: {
                asset: "base.png",
                texCoord: 0,
                colorSpace: "linear",
              },
            },
            "type",
            ".baseColorTexture.colorSpace",
          ),
      ],
      [
        "linearColorSpace",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "srgb",
              },
            },
            "type",
            ".normalTexture.colorSpace",
          ),
      ],
      [
        "transformType",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                transform: [],
              },
            },
            "type",
            ".normalTexture.transform",
          ),
      ],
      [
        "offsetType",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                transform: {
                  offset: null,
                  scale: { x: 1, y: 1 },
                  rotationDeg: 0,
                },
              },
            },
            "type",
            ".transform.offset",
          ),
      ],
      [
        "offsetAxis",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                transform: {
                  offset: { x: Infinity, y: 0 },
                  scale: { x: 1, y: 1 },
                  rotationDeg: 0,
                },
              },
            },
            "range",
            ".transform.offset.x",
          ),
      ],
      [
        "scaleZero",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                transform: {
                  offset: { x: 0, y: 0 },
                  scale: { x: 0, y: 1 },
                  rotationDeg: 0,
                },
              },
            },
            "range",
            ".transform.scale.x",
          ),
      ],
      [
        "rotation",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                transform: {
                  offset: { x: 0, y: 0 },
                  scale: { x: 1, y: 1 },
                  rotationDeg: NaN,
                },
              },
            },
            "range",
            ".transform.rotationDeg",
          ),
      ],
      [
        "samplerType",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                sampler: null,
              },
            },
            "type",
            ".normalTexture.sampler",
          ),
      ],
      [
        "wrapS",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                sampler: {
                  wrapS: "edge",
                  wrapT: "repeat",
                  minFilter: "linear",
                  magFilter: "linear",
                },
              },
            },
            "type",
            ".sampler.wrapS",
          ),
      ],
      [
        "wrapT",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                sampler: {
                  wrapS: "repeat",
                  wrapT: "edge",
                  minFilter: "linear",
                  magFilter: "linear",
                },
              },
            },
            "type",
            ".sampler.wrapT",
          ),
      ],
      [
        "minFilter",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                sampler: {
                  wrapS: "repeat",
                  wrapT: "repeat",
                  minFilter: "cubic",
                  magFilter: "linear",
                },
              },
            },
            "type",
            ".sampler.minFilter",
          ),
      ],
      [
        "magFilter",
        () =>
          materialRefusedAt(
            {
              normalTexture: {
                asset: "normal.png",
                texCoord: 0,
                colorSpace: "linear",
                sampler: {
                  wrapS: "repeat",
                  wrapT: "repeat",
                  minFilter: "linear",
                  magFilter: "cubic",
                },
              },
            },
            "type",
            ".sampler.magFilter",
          ),
      ],
      [
        "normalFinite",
        () =>
          materialRefusedAt({ normalScale: Infinity }, "range", ".normalScale"),
      ],
      [
        "occlusion",
        () =>
          materialRefusedAt(
            { occlusionStrength: 2 },
            "range",
            ".occlusionStrength",
          ),
      ],
      [
        "transmission",
        () => materialRefusedAt({ transmission: -1 }, "range", ".transmission"),
      ],
      ["ior", () => materialRefusedAt({ ior: 0.99 }, "range", ".ior")],
      [
        "thickness",
        () => materialRefusedAt({ thickness: -1 }, "range", ".thickness"),
      ],
      [
        "clearcoat",
        () => materialRefusedAt({ clearcoat: 2 }, "range", ".clearcoat"),
      ],
      [
        "doubleSided",
        () => materialRefusedAt({ doubleSided: "yes" }, "type", ".doubleSided"),
      ],
      [
        "alphaMode",
        () => materialRefusedAt({ alphaMode: "hash" }, "type", ".alphaMode"),
      ],
      [
        "alphaCutoffRange",
        () =>
          materialRefusedAt(
            { alphaMode: "mask", alphaCutoff: 2 },
            "range",
            ".alphaCutoff",
          ),
      ],
      [
        "alphaCutoffMode",
        () =>
          materialRefusedAt(
            { alphaMode: "blend", alphaCutoff: 0.5 },
            "type",
            ".alphaCutoff",
          ),
      ],
      [
        "opaqueOpacity",
        () =>
          materialRefusedAt(
            { alphaMode: "opaque", opacity: 0.5 },
            "type",
            ".opacity",
          ),
      ],
      [
        "transmissionCoverage",
        () =>
          materialRefusedAt(
            { alphaMode: "blend", transmission: 0.5 },
            "type",
            ".transmission",
          ),
      ],
    ]),
    {
      blankLegacy: true,
      bindingType: true,
      asset: true,
      uvSet: true,
      baseColorSpace: true,
      linearColorSpace: true,
      transformType: true,
      offsetType: true,
      offsetAxis: true,
      scaleZero: true,
      rotation: true,
      samplerType: true,
      wrapS: true,
      wrapT: true,
      minFilter: true,
      magFilter: true,
      normalFinite: true,
      occlusion: true,
      transmission: true,
      ior: true,
      thickness: true,
      clearcoat: true,
      doubleSided: true,
      alphaMode: true,
      alphaCutoffRange: true,
      alphaCutoffMode: true,
      opaqueOpacity: true,
      transmissionCoverage: true,
    },
  );
  TestValidator.predicate(
    "negative normal scale and opaque transmission are valid",
    validateMaterial({
      normalScale: -1,
      transmission: 0.5,
      emissive: { r: 0.2, g: 0.1, b: 0, a: null, hex: null },
    }).success,
  );
  TestValidator.predicate(
    "omitted alpha mode still derives legacy blend validation",
    validateMaterial({ opacity: 0.5 }).success,
  );

  const geometry = buildGeometry({
    type: "mesh",
    mesh: {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: [0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
      skin: null,
    },
  });
  TestValidator.equals(
    "one UV set is uploaded, the only set a binding may address",
    [
      [...geometry.getAttribute("uv").array],
      geometry.hasAttribute("uv1"),
      built.map?.channel,
      built.aoMap?.channel,
    ],
    [[0, 0, 1, 0, 0, 1], false, 0, 0],
  );

  const scene = new THREE.Scene();
  const texture = new THREE.Texture();
  const ldrVersion = texture.version;
  applySceneEnvironment(scene, ENVIRONMENT, texture);
  TestValidator.equals(
    "IBL image configures scene environment and background",
    namedFacts([
      ["environment", () => scene.environment === texture],
      ["background", () => scene.background === texture],
      [
        "mapping",
        () => texture.mapping === THREE.EquirectangularReflectionMapping,
      ],
      ["rotation", () => nclose(scene.environmentRotation.y, Math.PI / 2)],
      ["intensity", () => nclose(scene.environmentIntensity, 0.75)],
    ]),
    {
      environment: true,
      background: true,
      mapping: true,
      rotation: true,
      intensity: true,
    },
  );
  // An 8-bit sky stores sRGB-encoded texels and a float one stores linear
  // radiance, so a decoding left at the loader's default lights the room off a
  // radiance the image never held. The storage is the fact that decides it.
  const hdr = new THREE.DataTexture(
    new Uint16Array(4),
    1,
    1,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  const hdrVersion = hdr.version;
  applySceneEnvironment(scene, ENVIRONMENT, hdr);
  TestValidator.equals(
    "environment decoding follows the image's own storage",
    namedFacts([
      ["ldrSrgb", () => texture.colorSpace === THREE.SRGBColorSpace],
      ["ldrUploaded", () => texture.version > ldrVersion],
      ["hdrLinear", () => hdr.colorSpace === THREE.LinearSRGBColorSpace],
      ["hdrUploaded", () => hdr.version > hdrVersion],
      ["hdrMounted", () => scene.environment === hdr],
    ]),
    {
      ldrSrgb: true,
      ldrUploaded: true,
      hdrLinear: true,
      hdrUploaded: true,
      hdrMounted: true,
    },
  );
  applySceneEnvironment(scene, ENVIRONMENT, texture);
  const normalPass = applyRenderMode(scene, "normal");
  TestValidator.equals(
    "structural mode suspends and restores image lighting independently",
    namedFacts([
      ["environmentCleared", () => scene.environment === null],
      ["backgroundIsColor", () => scene.background instanceof THREE.Color],
      [
        "backgroundBlack",
        () =>
          // The `instanceof` is restated only to narrow the union inside this
          // closure; a comparison cannot move the answer.
          scene.background instanceof THREE.Color &&
          scene.background.getHex() === 0,
      ],
    ]),
    {
      environmentCleared: true,
      backgroundIsColor: true,
      backgroundBlack: true,
    },
  );
  normalPass.restore();
  TestValidator.equals(
    "structural mode restores exact environment instances",
    {
      environment: scene.environment === texture,
      background: scene.background === texture,
    },
    { environment: true, background: true },
  );
  applySceneEnvironment(scene, {
    ...ENVIRONMENT,
    image: null,
    background: { r: 0.1, g: 0.2, b: 0.3, a: null, hex: null },
  });
  TestValidator.equals(
    "solid environment background clears IBL",
    {
      environmentCleared: scene.environment === null,
      backgroundIsColor: scene.background instanceof THREE.Color,
    },
    { environmentCleared: true, backgroundIsColor: true },
  );
  applySceneEnvironment(scene, { ...ENVIRONMENT, image: "missing.hdr" });
  TestValidator.equals(
    "unresolved environment image is explicit transparent no-IBL",
    {
      environmentCleared: scene.environment === null,
      backgroundCleared: scene.background === null,
    },
    { environmentCleared: true, backgroundCleared: true },
  );
  applySceneEnvironment(scene, null);
  TestValidator.equals(
    "null clears scene environment",
    {
      environmentCleared: scene.environment === null,
      backgroundCleared: scene.background === null,
    },
    { environmentCleared: true, backgroundCleared: true },
  );

  const renderer = {
    toneMapping: THREE.LinearToneMapping,
    toneMappingExposure: 3,
    shadowMap: { enabled: false, type: THREE.BasicShadowMap },
  } as unknown as THREE.WebGLRenderer;
  /** The photographic policy the renderer carries at this instant. */
  const policy = () => ({
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    shadows: renderer.shadowMap.enabled,
    shadowType: renderer.shadowMap.type,
  });
  const beauty = applyRendererEnvironment(renderer, ENVIRONMENT, "beauty");
  TestValidator.equals("beauty applies tone, exposure and shadows", policy(), {
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1.25,
    shadows: true,
    shadowType: THREE.PCFSoftShadowMap,
  });
  beauty.restore();
  beauty.restore();
  TestValidator.equals("renderer state restores idempotently", policy(), {
    toneMapping: THREE.LinearToneMapping,
    exposure: 3,
    shadows: false,
    shadowType: THREE.BasicShadowMap,
  });
  const structural = applyRendererEnvironment(renderer, ENVIRONMENT, "mask");
  TestValidator.equals(
    "structural pass bypasses photographic settings",
    {
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
      shadows: renderer.shadowMap.enabled,
    },
    { toneMapping: THREE.NoToneMapping, exposure: 1, shadows: false },
  );
  structural.restore();
  const legacyBeauty = applyRendererEnvironment(renderer, null, "beauty");
  TestValidator.equals(
    "legacy beauty leaves host renderer policy unchanged",
    policy(),
    {
      toneMapping: THREE.LinearToneMapping,
      exposure: 3,
      shadows: false,
      shadowType: THREE.BasicShadowMap,
    },
  );
  legacyBeauty.restore();
  const legacyStructural = applyRendererEnvironment(renderer, null, "normal");
  TestValidator.equals(
    "legacy structural pass still bypasses photographic renderer state",
    {
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
      shadows: renderer.shadowMap.enabled,
    },
    { toneMapping: THREE.NoToneMapping, exposure: 1, shadows: false },
  );
  legacyStructural.restore();
  // Precedence: the delivery curve reaches the renderer only where no scene
  // environment owns one, and never over a scene that does.
  const delivered = applyRendererEnvironment(
    renderer,
    null,
    "beauty",
    "acesFilmic",
  );
  TestValidator.equals(
    "the render spec curve applies only to an environment-less scene",
    {
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
    },
    { toneMapping: THREE.ACESFilmicToneMapping, exposure: 3 },
  );
  delivered.restore();
  const overridden = applyRendererEnvironment(
    renderer,
    { ...ENVIRONMENT, toneMapping: "none" },
    "beauty",
    "acesFilmic",
  );
  TestValidator.equals(
    "a scene environment outranks the delivery default",
    renderer.toneMapping,
    THREE.NoToneMapping,
  );
  overridden.restore();
  const deliveredStructural = applyRendererEnvironment(
    renderer,
    null,
    "depth",
    "acesFilmic",
  );
  TestValidator.equals(
    "a structural pass ignores the delivery curve too",
    renderer.toneMapping,
    THREE.NoToneMapping,
  );
  deliveredStructural.restore();
  const none = applyRendererEnvironment(
    renderer,
    {
      ...ENVIRONMENT,
      toneMapping: "none",
      shadows: { enabled: true, type: "pcf" },
    },
    "beauty",
  );
  TestValidator.equals(
    "none tone map and PCF map exactly",
    { toneMapping: renderer.toneMapping, shadowType: renderer.shadowMap.type },
    { toneMapping: THREE.NoToneMapping, shadowType: THREE.PCFShadowMap },
  );
  none.restore();
  const vsm = applyRendererEnvironment(
    renderer,
    { ...ENVIRONMENT, shadows: { enabled: true, type: "vsm" } },
    "beauty",
  );
  TestValidator.equals(
    "VSM maps exactly",
    renderer.shadowMap.type,
    THREE.VSMShadowMap,
  );
  vsm.restore();
  // A scene that declares shadows off must turn them off, not merely decline to
  // turn them on: one renderer draws every shot on the page, so "leave it
  // alone" would inherit whatever the previous scene asked for.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const shadowless = applyRendererEnvironment(
    renderer,
    { ...ENVIRONMENT, shadows: { enabled: false, type: "vsm" } },
    "beauty",
  );
  const suspended = !renderer.shadowMap.enabled;
  shadowless.restore();
  TestValidator.equals(
    "a shadowless scene overrides a shadow-casting host and gives it back",
    [suspended, renderer.shadowMap.enabled, renderer.shadowMap.type],
    [true, true, THREE.PCFShadowMap],
  );
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const shadowed = buildLight({
    id: "sun",
    type: "directional",
    transform: {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    color: { r: 1, g: 1, b: 1, a: null, hex: null },
    intensity: 2,
    castShadow: true,
    shadow: { mapSize: 512, bias: -0.001, normalBias: 0.1, near: 0.2, far: 80 },
  }) as THREE.DirectionalLight;
  TestValidator.equals(
    "light shadow settings reach its camera and map",
    {
      castShadow: shadowed.castShadow,
      mapSize: shadowed.shadow.mapSize.x,
      bias: shadowed.shadow.bias,
      normalBias: shadowed.shadow.normalBias,
      near: shadowed.shadow.camera.near,
      far: shadowed.shadow.camera.far,
    },
    {
      castShadow: true,
      mapSize: 512,
      bias: -0.001,
      normalBias: 0.1,
      near: 0.2,
      far: 80,
    },
  );
  TestValidator.predicate(
    "light without shadow stays legacy",
    buildLight({
      id: "point",
      type: "point",
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      color: { r: 1, g: 1, b: 1, a: null, hex: null },
      intensity: 1,
      range: 0,
    }).castShadow === false,
  );
};
