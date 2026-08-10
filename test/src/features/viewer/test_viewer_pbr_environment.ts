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

/** PBR texture sampling and render environment reach their Three.js consumers. */
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
  TestValidator.predicate(
    "legacy material and unresolved texture preserve the no-map path",
    unresolved.map === null && !unresolved.transparent,
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
  TestValidator.predicate(
    "blend mode enables blending without writing opaque depth",
    blend.transparent && !blend.depthWrite,
  );
  const legacyBlend = buildMaterial({ ...base, opacity: 0.5 });
  TestValidator.predicate(
    "omitted alpha mode preserves legacy opacity blending",
    legacyBlend.transparent && !legacyBlend.depthWrite,
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
    "logical UV zero is available to AO and every PBR map",
    geometry.getAttribute("uv1").array,
    geometry.getAttribute("uv").array,
  );

  const scene = new THREE.Scene();
  const texture = new THREE.Texture();
  applySceneEnvironment(scene, ENVIRONMENT, texture);
  TestValidator.predicate(
    "IBL image configures scene environment and background",
    scene.environment === texture &&
      scene.background === texture &&
      texture.mapping === THREE.EquirectangularReflectionMapping &&
      nclose(scene.environmentRotation.y, Math.PI / 2) &&
      nclose(scene.environmentIntensity, 0.75),
  );
  const normalPass = applyRenderMode(scene, "normal");
  TestValidator.predicate(
    "structural mode suspends and restores image lighting independently",
    scene.environment === null &&
      scene.background instanceof THREE.Color &&
      scene.background.getHex() === 0,
  );
  normalPass.restore();
  TestValidator.predicate(
    "structural mode restores exact environment instances",
    scene.environment === texture && scene.background === texture,
  );
  applySceneEnvironment(scene, {
    ...ENVIRONMENT,
    image: null,
    background: { r: 0.1, g: 0.2, b: 0.3, a: null, hex: null },
  });
  TestValidator.predicate(
    "solid environment background clears IBL",
    scene.environment === null && scene.background instanceof THREE.Color,
  );
  applySceneEnvironment(scene, { ...ENVIRONMENT, image: "missing.hdr" });
  TestValidator.predicate(
    "unresolved environment image is explicit transparent no-IBL",
    scene.environment === null && scene.background === null,
  );
  applySceneEnvironment(scene, null);
  TestValidator.predicate(
    "null clears scene environment",
    scene.environment === null && scene.background === null,
  );

  const renderer = {
    toneMapping: THREE.LinearToneMapping,
    toneMappingExposure: 3,
    shadowMap: { enabled: false, type: THREE.BasicShadowMap },
  } as unknown as THREE.WebGLRenderer;
  const beauty = applyRendererEnvironment(renderer, ENVIRONMENT, "beauty");
  TestValidator.predicate(
    "beauty applies tone, exposure and shadows",
    renderer.toneMapping === THREE.ACESFilmicToneMapping &&
      renderer.toneMappingExposure === 1.25 &&
      renderer.shadowMap.enabled &&
      renderer.shadowMap.type === THREE.PCFSoftShadowMap,
  );
  beauty.restore();
  beauty.restore();
  TestValidator.predicate(
    "renderer state restores idempotently",
    renderer.toneMapping === THREE.LinearToneMapping &&
      renderer.toneMappingExposure === 3 &&
      !renderer.shadowMap.enabled &&
      renderer.shadowMap.type === THREE.BasicShadowMap,
  );
  const structural = applyRendererEnvironment(renderer, ENVIRONMENT, "mask");
  TestValidator.predicate(
    "structural pass bypasses photographic settings",
    renderer.toneMapping === THREE.NoToneMapping &&
      renderer.toneMappingExposure === 1 &&
      !renderer.shadowMap.enabled,
  );
  structural.restore();
  const legacyBeauty = applyRendererEnvironment(renderer, null, "beauty");
  TestValidator.predicate(
    "legacy beauty leaves host renderer policy unchanged",
    renderer.toneMapping === THREE.LinearToneMapping &&
      renderer.toneMappingExposure === 3 &&
      !renderer.shadowMap.enabled &&
      renderer.shadowMap.type === THREE.BasicShadowMap,
  );
  legacyBeauty.restore();
  const legacyStructural = applyRendererEnvironment(renderer, null, "normal");
  TestValidator.predicate(
    "legacy structural pass still bypasses photographic renderer state",
    renderer.toneMapping === THREE.NoToneMapping &&
      renderer.toneMappingExposure === 1 &&
      !renderer.shadowMap.enabled,
  );
  legacyStructural.restore();
  const none = applyRendererEnvironment(
    renderer,
    {
      ...ENVIRONMENT,
      toneMapping: "none",
      shadows: { enabled: true, type: "pcf" },
    },
    "beauty",
  );
  TestValidator.predicate(
    "none tone map and PCF map exactly",
    renderer.toneMapping === THREE.NoToneMapping &&
      renderer.shadowMap.type === THREE.PCFShadowMap,
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
  TestValidator.predicate(
    "light shadow settings reach its camera and map",
    shadowed.castShadow &&
      shadowed.shadow.mapSize.x === 512 &&
      shadowed.shadow.bias === -0.001 &&
      shadowed.shadow.normalBias === 0.1 &&
      shadowed.shadow.camera.near === 0.2 &&
      shadowed.shadow.camera.far === 80,
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
