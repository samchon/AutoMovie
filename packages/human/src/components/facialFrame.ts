import type { IPortraitComponentHost } from "../geometry/portraitComponents";
import type { IPortraitEyeSocket } from "./eyes";

/**
 * Craniofacial proportions on named anatomical supports of the version-one
 * landmark basis. They alter the common host before any attached part is built,
 * not a finished eyeball or an unrelated arbitrary displacement field.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Owns facial proportions, temporal breadth and mandibular/chin form.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Shares the changed facial foundation with all anatomical attachments.
 * @author Samchon
 */
export interface IPortraitFacialFrameShape {
  /** Transverse facial scale about the nasion, in [0.7,1.3]; default 1. */
  widthScale?: number;
  /** Vertical facial scale about the nasion, in [0.7,1.3]; default 1. */
  lengthScale?: number;
  /** Signed lateral mandibular-angle displacement in [-8,8] mm; positive widens. */
  jawWidth?: number;
  /** Gnathion inferior displacement in [-8,8] mm; positive lengthens the chin. */
  chinHeight?: number;
  /** Pogonion anterior displacement in [-8,8] mm; positive advances the chin. */
  chinProjection?: number;
  /** Frontal midline anterior displacement in [-8,8] mm; positive advances the forehead. */
  foreheadProjection?: number;
  /**
   * Superior-orbit foundation depth in [-8,8] mm; positive advances and negative
   * recesses both brow supports before fitting the eyes. Zero preserves the
   * original foundation. The optical aperture stays outside this support.
   */
  browProjection?: number;
  /** Signed lateral temporal displacement in [-8,8] mm; positive widens both temples. */
  templeWidth?: number;
}

/**
 * Resolve facial-frame dimensions without clipping and return owned settings.
 * Identity uses scales of one and displacements of zero, irrespective of person.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Defines omission, signed neutral values and finite detailed frame bounds.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Refuses out-of-envelope facial-frame combinations before constructing parts.
 */
export function resolvePortraitFacialFrameShape(
  input: IPortraitFacialFrameShape = {},
): Required<IPortraitFacialFrameShape> {
  const shape = {
    widthScale: 1,
    lengthScale: 1,
    jawWidth: 0,
    chinHeight: 0,
    chinProjection: 0,
    foreheadProjection: 0,
    browProjection: 0,
    templeWidth: 0,
    ...input,
  };
  for (const [key, value] of Object.entries(shape)) {
    const scale = key === "widthScale" || key === "lengthScale";
    if (
      !Number.isFinite(value) ||
      value < (scale ? 0.7 : -8) ||
      value > (scale ? 1.3 : 8)
    )
      throw new Error(`Invalid facial-frame dimension: ${key}.`);
  }
  return shape;
}

/**
 * Fit compact anatomical supports at the paired gonial and temporal landmarks,
 * gnathion, pogonion and frontal midline. The C1 compact kernel is one at its
 * anatomical centre and exactly zero outside its measured support radius.
 * Global width/length act last about the nasion. Every attached component reads
 * this same derived host; source observations and triangle identities survive.
 * A nonzero brow projection additionally needs both caller-owned eye sockets.
 * Its shared superior-orbit envelope preserves their aperture and changes the
 * outer skin before fitting eyelid attachments, not as a later skin overlay.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Makes jaw, chin, forehead, brow-foundation and temple controls actual shared anatomical construction.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Rebuilds surrounding parts from one changed host instead of moving independent overlays.
 */
export function createPortraitFacialFrame(
  host: IPortraitComponentHost,
  input: IPortraitFacialFrameShape = {},
  eyes?: readonly IPortraitEyeSocket[],
) {
  const shape = resolvePortraitFacialFrameShape(input);
  if (
    host.positions.length !== 478 ||
    host.positions.some(
      (point) => point.length !== 3 || !point.every(Number.isFinite),
    )
  )
    throw new Error("Facial-frame anatomy requires 478 finite XYZ landmarks.");
  const basis = structuredClone(host);
  const brow =
    shape.browProjection === 0
      ? undefined
      : createBrowProjection(basis, eyes, shape.browProjection);
  const point = (id: number): number[] => basis.positions[id];
  const width = Math.abs(point(454)[0] - point(234)[0]);
  const length = Math.abs(point(10)[1] - point(152)[1]);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(length) ||
    width <= 1 ||
    length <= 1
  )
    throw new Error(
      "Facial-frame supports need nondegenerate zygomatic breadth and frontal-to-chin length.",
    );
  const weight = (
    sample: readonly number[],
    id: number,
    rx: number,
    ry: number,
  ): number => {
    const anchor = point(id);
    const radius = Math.hypot(
      (sample[0] - anchor[0]) / rx,
      (sample[1] - anchor[1]) / ry,
      (sample[2] - anchor[2]) / (width * 0.4),
    );
    const t = Math.max(0, 1 - radius * radius);
    return t * t;
  };
  const transform = (sample: readonly number[]): number[] => {
    if (sample.length !== 3 || !sample.every(Number.isFinite))
      throw new Error("A facial-frame attachment must be finite XYZ.");
    const jaw =
      weight(sample, 397, width * 0.32, length * 0.32) -
      weight(sample, 172, width * 0.32, length * 0.32);
    const temple =
      weight(sample, 356, width * 0.22, length * 0.22) -
      weight(sample, 127, width * 0.22, length * 0.22);
    const nasion = point(168);
    const result = [
      sample[0] +
        (sample[0] - nasion[0]) * (shape.widthScale - 1) +
        (shape.jawWidth * jaw + shape.templeWidth * temple) * shape.widthScale,
      sample[1] +
        (sample[1] - nasion[1]) * (shape.lengthScale - 1) -
        shape.chinHeight *
          weight(sample, 152, width * 0.3, length * 0.3) *
          shape.lengthScale,
      sample[2] +
        shape.chinProjection * weight(sample, 199, width * 0.3, length * 0.3) +
        shape.foreheadProjection *
          weight(sample, 10, width * 0.45, length * 0.4) +
        (brow?.(sample) ?? 0),
    ];
    if (!result.every(Number.isFinite))
      throw new Error(
        "Facial-frame transformation overflowed its numerical range.",
      );
    return result;
  };
  return {
    host: { ...basis, positions: basis.positions.map(transform) },
    transform,
  };
}

function createBrowProjection(
  host: IPortraitComponentHost,
  eyes: readonly IPortraitEyeSocket[] | undefined,
  amount: number,
): (sample: readonly number[]) => number {
  if (
    eyes === undefined ||
    eyes.length !== 2 ||
    !eyes.some((eye) => eye.name === "left") ||
    !eyes.some((eye) => eye.name === "right")
  )
    throw new Error(
      "Brow foundation needs both independently named eye sockets.",
    );
  const guides = eyes.map((eye) => {
    const aperture = [...eye.top, ...eye.bottom];
    if (
      aperture.length === 0 ||
      eye.browBottom.length < 2 ||
      [...aperture, ...eye.browBottom].some(
        (id) => !Number.isInteger(id) || id < 0 || id >= host.positions.length,
      )
    )
      throw new Error(
        "Brow foundation needs resident aperture and brow guides.",
      );
    return {
      aperture: aperture.map((id) => host.positions[id]),
      brow: eye.browBottom.map((id) => host.positions[id]),
    };
  });
  // Both fields share the highest aperture floor. Overlapping medial shoulders
  // cannot move the other eye's higher aperture in an asymmetric foundation.
  const floor =
    Math.max(...guides.flatMap((guide) => guide.aperture.map((p) => p[1]))) +
    0.5;
  const sections = guides.map(({ aperture: points, brow }) => {
    const crest = brow.reduce((sum, p) => sum + p[1] / brow.length, 0);
    const width =
      Math.max(...points.map((p) => p[0])) -
      Math.min(...points.map((p) => p[0]));
    const top = crest + 2 * (crest - floor);
    const left = Math.min(...brow.map((p) => p[0]));
    const right = Math.max(...brow.map((p) => p[0]));
    if (
      ![floor, crest, width, top, left, right].every(Number.isFinite) ||
      crest <= floor + 1 ||
      width <= 1 ||
      right <= left
    )
      throw new Error(
        "Brow foundation needs a finite superior band above a nondegenerate aperture.",
      );
    return { floor, crest, top, left, right, shoulder: width / 4 };
  });
  const smooth = (x: number): number => {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  };
  return (sample) =>
    amount *
    Math.max(
      ...sections.map(
        (section) =>
          smooth(
            (sample[0] - section.left + section.shoulder) / section.shoulder,
          ) *
          smooth(
            (section.right + section.shoulder - sample[0]) / section.shoulder,
          ) *
          (sample[1] < section.crest
            ? smooth(
                (sample[1] - section.floor) / (section.crest - section.floor),
              )
            : smooth(
                (section.top - sample[1]) / (section.top - section.crest),
              )),
      ),
    );
}
