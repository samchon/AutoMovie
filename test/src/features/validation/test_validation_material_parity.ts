import {
  AUTO_MOVIE_SUPPORTED_MATERIAL_EXTENSIONS,
  isAutoMovieMaterialExtension,
  unsupportedAutoMovieMaterialExtensions,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/**
 * An imported glTF material is claimed as parity only where automovie can say
 * the same thing.
 *
 * Scenarios:
 *
 * 1. The four extensions `IAutoMovieMaterial` restates are accepted silently, and
 *    an asset carrying only those (or none at all) reports nothing.
 * 2. Every other material or texture extension is reported once, sorted, and
 *    de-duplicated, whether it is a published KHR one, a vendor one, or an
 *    identity published after this list was written.
 * 3. Extensions about geometry, compression, lighting or the container are not
 *    this gate's business and are left alone.
 */
export const test_validation_material_parity = (): void => {
  TestValidator.equals(
    "the supported set is exactly what the material type can restate",
    [...AUTO_MOVIE_SUPPORTED_MATERIAL_EXTENSIONS].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
    [
      "KHR_materials_clearcoat",
      "KHR_materials_ior",
      "KHR_materials_transmission",
      "KHR_texture_transform",
    ],
  );

  TestValidator.equals(
    "a parity-only asset reports nothing",
    [
      unsupportedAutoMovieMaterialExtensions([]),
      unsupportedAutoMovieMaterialExtensions([
        "KHR_texture_transform",
        "KHR_materials_ior",
        "KHR_materials_transmission",
        "KHR_materials_clearcoat",
        "KHR_draco_mesh_compression",
        "KHR_mesh_quantization",
        "KHR_lights_punctual",
        "VRMC_vrm",
        "KHR_animation_pointer",
      ]),
    ],
    [[], []],
  );

  TestValidator.equals(
    "everything automovie cannot restate is reported once, in order",
    unsupportedAutoMovieMaterialExtensions([
      "VRMC_materials_mtoon",
      "KHR_materials_sheen",
      "KHR_materials_volume",
      "KHR_materials_ior",
      "KHR_materials_sheen",
      "EXT_texture_webp",
      "KHR_materials_pbrSpecularGlossiness",
      "KHR_texture_basisu",
      "KHR_materials_emissive_strength",
    ]),
    [
      "EXT_texture_webp",
      "KHR_materials_emissive_strength",
      "KHR_materials_pbrSpecularGlossiness",
      "KHR_materials_sheen",
      "KHR_materials_volume",
      "KHR_texture_basisu",
      "VRMC_materials_mtoon",
    ],
  );

  TestValidator.equals(
    "the material/texture question is decided by the identity's own segments",
    namedFacts([
      ["material", () => isAutoMovieMaterialExtension("KHR_materials_sheen")],
      [
        "singularMaterial",
        () => isAutoMovieMaterialExtension("ADOBE_material_thin_glass"),
      ],
      ["texture", () => isAutoMovieMaterialExtension("KHR_texture_transform")],
      ["textures", () => isAutoMovieMaterialExtension("EXT_textures_webp")],
      [
        "caseFolded",
        () => isAutoMovieMaterialExtension("VENDOR_Materials_future"),
      ],
      [
        "notGeometry",
        () =>
          isAutoMovieMaterialExtension("KHR_draco_mesh_compression") === false,
      ],
      [
        "notLighting",
        () => isAutoMovieMaterialExtension("KHR_lights_punctual") === false,
      ],
      [
        "notSubstring",
        () => isAutoMovieMaterialExtension("KHR_immaterialism") === false,
      ],
    ]),
    {
      material: true,
      singularMaterial: true,
      texture: true,
      textures: true,
      caseFolded: true,
      notGeometry: true,
      notLighting: true,
      notSubstring: true,
    },
  );
};
