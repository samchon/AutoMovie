import type { IAutoMovieMaterial } from "@automovie/interface";

import { createPortraitIrisMaterials } from "./irisPigment";

/**
 * Provisional linear-RGB PBR finishes. These values are not sampled sRGB pixels
 * from the photograph, and the reference photo is not used as a skin texture.
 * Keep IDs stable: the anatomical builders bind their parts to these names.
 * Diagnostic clay views replace finishes while keeping these same mesh buffers.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies stable material identities used by anatomical skin, ocular, nasal and oral parts.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Creates fresh untextured linear-RGB PBR records, including the shared iris palette and separate corneal-supporting tissue finishes.
 */
export function createPortraitMaterials(): IAutoMovieMaterial[] {
  const materials: IAutoMovieMaterial[] = [];
  const material = (id: string, rgb: number[], roughness: number): string => {
    materials.push({
      id,
      name: id,
      baseColor: { r: rgb[0], g: rgb[1], b: rgb[2], a: 1, hex: null },
      roughness,
      metallic: 0,
      opacity: 1,
      emissive: null,
      baseColorTexture: null,
      doubleSided: true,
    });
    return id;
  };
  // Warm linear albedo and a broad rough lobe are authored appearance controls.
  // They describe the material globally, never reference pixels or a mask.
  material("skin", [0.58, 0.34, 0.3], 0.52);
  // Clearcoat remains a small separate specular lobe; it does not simulate
  // subsurface scattering or imply a measured tissue thickness.
  const skin = materials[materials.length - 1]!;
  skin.clearcoat = 0.09;
  // A rosy vermilion finish remains independent of the lip section and oral
  // contact. Its broad lobe is an appearance fit, not photographic texture.
  material("lips", [0.48, 0.16, 0.18], 0.6);
  // The sclera has a broad surface response. The transparent eye-owned cornea
  // carries the sharp highlight over the iris; repeating a mirror-like lobe on
  // opaque pigment beneath it would add a second unrelated reflective surface.
  // These are authored PBR approximations, not measured tissue reflectance.
  material("sclera", [0.66, 0.64, 0.58], 0.22);
  // Vascular medial conjunctiva and the narrow moist lid edge have distinct
  // surface responses. These linear-RGB fits are not sampled photograph pixels
  // or a physiological scattering model; geometry determines their coverage.
  material("ocular-corner", [0.48, 0.24, 0.2], 0.42);
  material("ocular-margin", [0.58, 0.36, 0.28], 0.28);
  // Radial pigment bands vary a dark brown iris without changing its outline.
  // The geometry selects these colours deterministically; no reference pixels
  // are projected onto the eye and no lighting is baked into the pigment.
  materials.push(
    ...createPortraitIrisMaterials("iris", {
      base: [0.009, 0.006, 0.004],
      variation: [0.05, 0.031, 0.012],
    }),
  );
  // The pupil patch approximates the dark opening into the eye. Its opaque
  // stand-in must not produce a sharp painted-looking secondary catchlight.
  material("pupil", [0.0025, 0.002, 0.0015], 1);
  material("mouth-interior", [0.035, 0.006, 0.011], 0.85);
  material("teeth", [0.74, 0.69, 0.57], 0.3);
  material("brows", [0.023, 0.016, 0.013], 0.76);
  material("hair", [0.013, 0.009, 0.0065], 0.73);
  // The visible nasal vestibule is a tissue surface; its recessed geometry and
  // illumination supply the shadow. Keep its base colour in the tissue range
  // rather than baking the photographed cavity darkness into the albedo too.
  // This warm linear-RGB fit is authored, not measured mucosal reflectance.
  material("nasal-interior", [0.42, 0.23, 0.19], 0.87);
  return materials;
}
