import { zlibSync } from "fflate";

/**
 * Generate a resident PNG mask for a bundle of painted fibres. The 128 by 256
 * RGBA image contains longitudinal colour variation, root fade and staggered
 * tapered tips. A seed controls only deterministic arithmetic, never randomness.
 * The returned data URI is self-contained and needs no photograph or network.
 * Coverage is an authoring ratio, not a measured biological hair density.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies repeatable fibre coverage for surface hair rather than a mesh for every fibre.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Encodes root-to-tip variation and an alpha silhouette in a resident normalized-UV PNG.
 */
export function createPortraitHairTexture(
  seed: number,
  fibres: number,
  coverage: number,
): string {
  return createTexture(seed, fibres, coverage, false);
}

/**
 * Generate an RGB tangent-space normal PNG from the same fibre coverage that
 * owns the colour mask. Across each winning fibre a circular cross-section
 * supplies X and Z; Y is neutral. Empty samples retain the flat card normal.
 * This shading detail adds no vertices and does not model hair scattering.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies fibre relief on surface locks without constructing individual hair meshes.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Encodes the mask's shared fibre centres and radii as linear tangent-space normals.
 */
export function createPortraitHairNormalTexture(
  seed: number,
  fibres: number,
  coverage: number,
): string {
  return createTexture(seed, fibres, coverage, true);
}

function createTexture(
  seed: number,
  fibres: number,
  coverage: number,
  normal: boolean,
): string {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(fibres) ||
    fibres < 1 ||
    fibres > 32 ||
    !Number.isFinite(coverage) ||
    coverage < 0.1 ||
    coverage > 1
  )
    throw new Error(
      "Hair texture needs an unsigned seed, 1..32 fibres and coverage in [0.1,1].",
    );
  const width = 128,
    height = 256,
    channels = normal ? 3 : 4,
    stride = 1 + width * channels;
  const bytes = new Uint8Array(stride * height);
  const noise = (i: number) => {
    const value = Math.imul((i + 1) ^ seed, 0x45d9f3b);
    return (value >>> 0) / 0x100000000;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const t = y / (height - 1),
        u = (x + 0.5) / width;
      let alpha = 0,
        shade = 0.65,
        transverse = 0;
      for (let f = 0; f < fibres; f++) {
        const phase = noise(f),
          tip = 0.72 + 0.28 * noise(f + 37);
        const center =
          (f + 0.5 + 0.2 * Math.sin(t * 5 + phase * 6.28)) / fibres;
        const taper = Math.max(0, Math.min(1, (tip - t) / 0.15));
        const radius = (coverage / (fibres * 2)) * (0.6 + 0.4 * taper);
        const edge = Math.max(
          0,
          Math.min(1, (radius - Math.abs(u - center)) * width + 0.5),
        );
        const density = edge * Math.min(1, t * 40) * taper;
        if (density > alpha) {
          alpha = density;
          shade = 0.55 + 0.4 * phase + 0.05 * Math.sin(t * 18 + f);
          transverse = Math.max(-1, Math.min(1, (u - center) / radius));
        }
      }
      const at = y * stride + 1 + x * channels;
      if (normal) {
        bytes[at] = Math.round(127.5 * (1 + transverse));
        bytes[at + 1] = 128;
        bytes[at + 2] = Math.round(
          127.5 * (1 + Math.sqrt(1 - transverse * transverse)),
        );
      } else {
        for (let channel = 0; channel < 3; channel++)
          bytes[at + channel] = Math.round(255 * shade);
        bytes[at + 3] = Math.round(255 * alpha);
      }
    }
  const header = new Uint8Array(13),
    view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = normal ? 2 : 6;
  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(bytes, { level: 6 })),
    chunk("IEND", new Uint8Array()),
  ];
  let binary = "";
  for (const part of chunks)
    for (const value of part) binary += String.fromCharCode(value);
  return "data:image/png;base64," + btoa(binary);
}

function chunk(name: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 12),
    view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[4 + i] = name.charCodeAt(i);
  bytes.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < bytes.length - 4; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ ((crc & 1) * 0xedb88320);
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
  return bytes;
}
