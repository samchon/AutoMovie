import type { IAutoMovieMaterial } from "@automovie/interface";

/**
 * Provisional linear-RGB PBR finishes. These values are not sampled sRGB pixels
 * from the photograph, and the reference photo is not used as a skin texture.
 * Keep IDs stable: the anatomical builders bind their parts to these names.
 * Diagnostic clay views replace finishes while keeping these same mesh buffers.
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
  material("skin", [0.63, 0.41, 0.285], 0.63);
  material("lips", [0.48, 0.125, 0.145], 0.46);
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
  for (let i = 0; i < 8; i++) {
    const tone = i / 7;
    material(
      `iris-${i}`,
      [0.009 + 0.05 * tone, 0.006 + 0.031 * tone, 0.004 + 0.012 * tone],
      0.65,
    );
  }
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
