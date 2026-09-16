import { zlibSync } from "fflate";

import type { IPortraitHairShape } from "./hairCards";

/**
 * Admit a complete normalized curl pattern independently of groom population.
 * Geometry and texture construction call the same admission, so an empty groom
 * cannot conceal an invalid optional profile until strands are added later.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Rejects invalid complete curl profiles without clamping or mutating the authored values.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Applies finite inclusive curl-pattern envelopes before either geometry or texture construction.
 */
export function assertPortraitHairFibreCurl(
  curl: NonNullable<IPortraitHairShape["fibreCurl"]>,
): void {
  if (
    curl === null ||
    typeof curl !== "object" ||
    !Number.isFinite(curl.amplitude) ||
    curl.amplitude < 0 ||
    curl.amplitude > 0.5 ||
    !Number.isFinite(curl.cycles) ||
    curl.cycles < 0 ||
    curl.cycles > 16 ||
    !Number.isFinite(curl.aspectRatio) ||
    curl.aspectRatio < 0.01 ||
    curl.aspectRatio > 100
  )
    throw new Error(
      "Hair curl needs finite amplitude [0,0.5], cycles [0,16] and aspect ratio [0.01,100].",
    );
}

/**
 * Generate a resident PNG mask for a bundle of painted fibres. The 128 by 256
 * RGBA image contains longitudinal colour variation, root fade and staggered
 * tapered tips. A seed controls only deterministic arithmetic, never randomness.
 * An optional complete curl profile uses a 512-square pattern with independent
 * seeded waves; omission retains the original raster and bytes. The returned
 * data URI is self-contained and needs no photograph or network.
 * Coverage is an authoring ratio, not a measured biological hair density.
 * Shade strength in [0,1] interpolates encoded RGB towards white independently
 * of alpha. Omission or one preserves the original raster bytes; zero leaves
 * all pigmentation to the authored base finish, including for pale hair.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies repeatable fibre coverage for surface hair rather than a mesh for every fibre.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Encodes root-to-tip variation and an alpha silhouette in a resident normalized-UV PNG.
 */
export function createPortraitHairTexture(
  seed: number,
  fibres: number,
  coverage: number,
  curl?: IPortraitHairShape["fibreCurl"],
  shadeStrength = 1,
): string {
  return createTexture(seed, fibres, coverage, false, curl, shadeStrength);
}

/**
 * Generate an RGB tangent-space normal PNG from the same fibre coverage that
 * owns the colour mask. Across each winning fibre a circular cross-section
 * supplies X and Z; Y is neutral in the legacy pattern. A curl profile rotates
 * that transverse normal perpendicular to its wave tangent using the authored
 * nominal aspect ratio. Empty samples retain the flat card normal.
 * This shading detail adds no vertices and does not model hair scattering.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies fibre relief on surface locks without constructing individual hair meshes.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Encodes the mask's shared fibre centres and radii as linear tangent-space normals.
 */
export function createPortraitHairNormalTexture(
  seed: number,
  fibres: number,
  coverage: number,
  curl?: IPortraitHairShape["fibreCurl"],
): string {
  return createTexture(seed, fibres, coverage, true, curl);
}

function createTexture(
  seed: number,
  fibres: number,
  coverage: number,
  normal: boolean,
  curl?: IPortraitHairShape["fibreCurl"],
  shadeStrength = 1,
): string {
  if (curl !== undefined) assertPortraitHairFibreCurl(curl);
  if (!Number.isFinite(shadeStrength) || shadeStrength < 0 || shadeStrength > 1)
    throw new Error("Hair fibre shade strength must be finite in [0,1].");
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
  const width = curl === undefined ? 128 : 512,
    height = curl === undefined ? 256 : 512,
    channels = normal ? 3 : 4,
    stride = 1 + width * channels;
  const bytes = new Uint8Array(stride * height);
  const noise = (i: number) => {
    const value = Math.imul((i + 1) ^ seed, 0x45d9f3b);
    return (value >>> 0) / 0x100000000;
  };
  const curlNoise = (i: number): number => {
    let value = (i + 1) ^ seed;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
    return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
  };
  // Trigonometry belongs to one fibre at one row, not every raster column.
  const curlRows =
    curl === undefined
      ? undefined
      : Array.from({ length: height }, (_, y) =>
          Array.from({ length: fibres }, (_, f) => {
            const t = y / (height - 1);
            const amplitude =
              curl.amplitude * (0.65 + 0.35 * curlNoise(f + 17));
            const frequency = curl.cycles * (0.8 + 0.4 * curlNoise(f + 11));
            const angle = 2 * Math.PI * (curlNoise(f) + frequency * t);
            return {
              center: (f + 0.5) / fibres + amplitude * Math.sin(angle),
              slope:
                amplitude *
                2 *
                Math.PI *
                frequency *
                Math.cos(angle) *
                curl.aspectRatio,
            };
          }),
        );
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const t = y / (height - 1),
        u = (x + 0.5) / width;
      let alpha = 0,
        shade = 0.65,
        transverse = 0,
        slope = 0;
      for (let f = 0; f < fibres; f++) {
        const phase = noise(f),
          tip = 0.72 + 0.28 * noise(f + 37);
        const wave = curlRows?.[y][f];
        const center =
          wave === undefined
            ? (f + 0.5 + 0.2 * Math.sin(t * 5 + phase * 6.28)) / fibres
            : wave.center;
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
          slope = wave === undefined ? 0 : wave.slope;
        }
      }
      const at = y * stride + 1 + x * channels;
      if (normal) {
        const crossScale = Math.hypot(1, slope);
        bytes[at] = Math.round(127.5 * (1 + transverse / crossScale));
        bytes[at + 1] = Math.round(
          127.5 * (1 - (transverse * slope) / crossScale),
        );
        bytes[at + 2] = Math.round(
          127.5 * (1 + Math.sqrt(1 - transverse * transverse)),
        );
      } else {
        if (shadeStrength !== 1) shade = 1 - shadeStrength * (1 - shade);
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
