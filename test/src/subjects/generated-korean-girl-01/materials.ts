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
  material("skin", [0.66, 0.42, 0.32], 0.63);
  material("lips", [0.52, 0.155, 0.18], 0.46);
  // Low ocular roughness supplies a wet specular response to the actual scene
  // lights. Pigment colours carry no painted catchlights or baked illumination.
  material("sclera", [0.66, 0.64, 0.58], 0.08);
  // Radial pigment bands vary a dark brown iris without changing its outline.
  // The geometry selects these colours deterministically; no reference pixels
  // are projected onto the eye and no lighting is baked into the pigment.
  for (let i = 0; i < 8; i++) {
    const tone = i / 7;
    material(
      `iris-${i}`,
      [0.009 + 0.05 * tone, 0.006 + 0.031 * tone, 0.004 + 0.012 * tone],
      0.08,
    );
  }
  material("pupil", [0.0025, 0.002, 0.0015], 0.08);
  material("mouth-interior", [0.035, 0.006, 0.011], 0.85);
  material("teeth", [0.83, 0.78, 0.66], 0.3);
  material("brows", [0.023, 0.016, 0.013], 0.76);
  // Nasal lining has its own dark diffuse finish. The cavity's occlusion and
  // inward-facing walls supply depth; this colour does not replace geometry.
  material("nasal-interior", [0.095, 0.035, 0.025], 0.87);
  return materials;
}
