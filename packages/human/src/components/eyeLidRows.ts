import { portraitMix as mix } from "../geometry/geometry";
import type { IPortraitEyeShape, IPortraitEyeSocket } from "./eyeShape";
import type {
  IPortraitLowerLidSection,
  createPortraitLowerLidProfile,
} from "./lowerLidSection";
import type {
  IPortraitUpperLidSection,
  createPortraitUpperLidProfile,
} from "./upperLidSection";

const pi = Math.PI;

/**
 * Counterclockwise aperture identities, sharing both canthi exactly once.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Orders the socket's lower and upper rims for shared lid construction.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Retains caller vertex identities while reversing only the upper interior.
 */
export const portraitEyeLoop = (socket: IPortraitEyeSocket): number[] => [
  ...socket.bottom,
  ...socket.top.slice(1, -1).reverse(),
];

/**
 * One numerical section calculation supplies both the skin constraint and lid rings.
 * Coordinates and offsets are millimetres; an optional fixed guide owns the
 * outer seam while posed contact fades across the same transverse section.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs named upper/lower tissue rows from independent anatomical profiles.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Keeps host attachment targets and emitted eyelid geometry on one section formula.
 */
// One calculation supplies both the part boundary constraint and its lid rows.
// The host and the component therefore cannot disagree about the seam position.
export const portraitEyeLidRows = (
  source: number[][],
  socket: IPortraitEyeSocket,
  shape: IPortraitEyeShape,
  outerDepths?: ReadonlyMap<number, number>,
  lowerProfile?: ReturnType<typeof createPortraitLowerLidProfile>,
  guide?: readonly (readonly number[])[],
  upperProfile?: ReturnType<typeof createPortraitUpperLidProfile>,
) => {
  const loop = portraitEyeLoop(socket);
  const frame = guide ?? source;
  const left = Math.min(...loop.map((id) => frame[id][0]));
  const right = Math.max(...loop.map((id) => frame[id][0]));
  return loop.map((id, index) => {
    const point = source[id];
    const nominal = frame[id];
    // The rim expands along its own planar normal, independently of gaze.
    // Counterclockwise boundary order gives the outward normal directly; the
    // iris marker does not participate in the surrounding skin's shape.
    const before = frame[loop[(index + loop.length - 1) % loop.length]];
    const after = frame[loop[(index + 1) % loop.length]];
    const nx = after[1] - before[1];
    const ny = before[0] - after[0];
    const distance = Math.hypot(nx, ny);
    const weight = socket.top.includes(id)
      ? Math.sin((pi * (nominal[0] - left)) / (right - left))
      : 0;
    const progress = (nominal[0] - left) / (right - left);
    const anatomicalProgress = socket.name === "left" ? progress : 1 - progress;
    // Pretarsal lower fullness cannot replace upper fold or canthal sections.
    const lowerRoll = socket.top.includes(id) ? undefined : shape.aegyoSal;
    const detail = socket.top.includes(id)
      ? undefined
      : lowerProfile?.(anatomicalProgress);
    const upperDetail =
      socket.top.includes(id) && !socket.bottom.includes(id)
        ? upperProfile?.(anatomicalProgress)
        : undefined;
    const at = (
      offset: number,
      depth: number,
      role?: Exclude<keyof IPortraitLowerLidSection, "attachment">,
      upperRole?: Exclude<keyof IPortraitUpperLidSection, "attachment">,
    ): number[] => {
      if (upperDetail !== undefined && upperRole !== undefined) {
        offset = offset * (1 - weight) + upperDetail[upperRole].offset * weight;
        depth =
          depth * (1 - weight) + upperDetail[upperRole].projection * weight;
      }
      if (
        detail !== undefined &&
        role !== undefined &&
        lowerRoll === undefined
      ) {
        // Replace this section point within the canthal boundary blend. The
        // old lower-roll depth is not added to the new anatomical projection.
        offset = offset * (1 - lowerWeight) + detail[role].offset * lowerWeight;
        depth =
          depth * (1 - lowerWeight) + detail[role].projection * lowerWeight;
      }
      // A supplied aegyo-sal owns one visible pretarsal cross-section. The
      // former detailed profile remains a valid optional fallback, but its
      // several closely spaced rows can read as parallel carved lines in a
      // close render. Replace those lower rows with a single crest and one
      // rapidly fading shoulder, then let the host resume at preseptal skin.
      if (role !== undefined && lowerRoll !== undefined) {
        const roll = lowerRoll;
        const smoothDecay = (at: number): number => {
          const t = Math.max(0, Math.min(1, at));
          const smooth = t * t * (3 - 2 * t);
          return 1 - smooth;
        };
        const section = {
          pretarsalCrest: {
            offset: roll.offset,
            projection: roll.projection,
            decay: 1,
          },
          pretarsalLower: {
            offset: roll.offset + roll.height * 0.35,
            projection: roll.projection * smoothDecay(0.35),
            decay: smoothDecay(0.35),
          },
          subtarsalInner: {
            offset: roll.offset + roll.height * 0.65,
            projection: roll.projection * smoothDecay(0.65),
            decay: smoothDecay(0.65),
          },
          subtarsalOuter: {
            offset: roll.offset + roll.height * 0.95,
            projection: roll.projection * smoothDecay(0.95),
            decay: smoothDecay(0.95),
          },
          preseptal: {
            offset: roll.offset + roll.height * 1.25,
            projection: 0,
            decay: 0,
          },
          margin: { offset: 0.16, projection: 0.12, decay: 0 },
        }[role];
        // The optional longitudinal weights are the roll's medial-to-lateral
        // fullness witnesses. They modulate one cross-section; they must not
        // reintroduce the old detailed profile as a second set of ridges.
        const weights = roll.weights;
        const position = Math.max(0, Math.min(1, anatomicalProgress)) * 6;
        const index = Math.min(5, Math.floor(position));
        const weight =
          weights === undefined
            ? 1
            : weights[index] * (1 - (position - index)) +
              weights[index + 1] * (position - index);
        // Width and reach are image-fit controls, not metadata.  Width scales
        // the visible fullness against the authored lateral reach; reach then
        // gates the roll toward each canthus so the pad occupies the same
        // measured fraction of the lower-lid silhouette as the reference.
        const lateral = Math.abs(progress - 0.5) * 2;
        const span = Math.max(right - left, 1e-6);
        const envelope = (range: number): number => {
          const fraction = Math.max(0, Math.min(1, range / span));
          if (fraction >= 1 || lateral <= fraction) return 1;
          const t = (lateral - fraction) / (1 - fraction);
          return 1 - t * t * (3 - 2 * t);
        };
        const rollWeight =
          lowerWeight * weight * envelope(roll.width) * envelope(roll.reach);
        // A supplied roll owns its complete section. Blending offsets back to
        // the basic envelope at the canthi leaves the old shell's attachment
        // rows visible as a competing shelf. The longitudinal weight only
        // fades relief; the anatomical offsets stay on one continuous profile.
        offset = section.offset;
        depth = roll.projection * section.decay * rollWeight;
      }
      const t = Math.min(1, offset / outerWidth),
        blend = t * t * (3 - 2 * t);
      return [
        guide === undefined
          ? point[0] + (offset * nx) / distance
          : nominal[0] +
            (offset * nx) / distance +
            (point[0] - nominal[0]) * (1 - blend),
        guide === undefined
          ? point[1] + (offset * ny) / distance
          : nominal[1] +
            (offset * ny) / distance +
            (point[1] - nominal[1]) * (1 - blend),
        mix(point[2], outerDepths?.get(id) ?? point[2], blend) + depth,
      ];
    };
    // Two nearby support rows delimit the supratarsal crease through common
    // Loop subdivision and retain its depth between the tarsal ridge and hood.
    // The hood sits above the recessed fold and produces a real cast shadow.
    // Weight fades the fold at both canthi and leaves the lower lid uncreased.
    const fold = shape.foldWidth * weight;
    const depth = shape.foldDepth * weight;
    const lowerWeight = socket.top.includes(id)
      ? 0
      : Math.sin((pi * (nominal[0] - left)) / (right - left));
    // This basic lower branch is only a two-control envelope. Its shared row
    // names below come from the upper-lid construction; they do not imply an
    // independently authored pretarsal body, subtarsal boundary or preseptal
    // section. In particular, corneal clearance added later is contact data,
    // not the anatomical definition of the lower roll. An optional detailed
    // lower-lid profile supplies those independently authored section controls.
    const lowerWidth = shape.lowerLidWidth * lowerWeight;
    const lowerVolume = shape.lowerLidVolume * lowerWeight;
    const basicWidth = 1.2 + (shape.foldWidth + 2.2) * weight + lowerWidth;
    const outerWidth =
      upperDetail !== undefined
        ? basicWidth * (1 - weight) + upperDetail.attachment * weight
        : detail === undefined
          ? basicWidth
          : basicWidth * (1 - lowerWeight) + detail.attachment * lowerWeight;
    return {
      id,
      outer: at(
        outerWidth,
        lowerRoll === undefined ? -0.4 + 0.2 * weight : 0.04 * lowerWeight,
      ),
      hoodUpper: at(
        1.0 + (shape.foldWidth + 1.1) * weight + 0.9 * lowerWidth,
        shape.lidThickness + 0.45 * depth + 0.1 * lowerVolume,
        "preseptal",
        "preseptal",
      ),
      hoodEdge: at(
        0.85 + fold + 0.75 * lowerWidth,
        shape.lidThickness + 0.5 * depth + 0.3 * lowerVolume,
        "subtarsalOuter",
        "hood",
      ),
      creaseOuter: at(
        0.65 + fold + 0.6 * lowerWidth,
        shape.lidThickness - depth + 0.6 * lowerVolume,
        "subtarsalInner",
        "creaseOuter",
      ),
      creaseInner: at(
        0.4 + fold + 0.45 * lowerWidth,
        shape.lidThickness - depth + lowerVolume,
        "pretarsalLower",
        "creaseInner",
      ),
      tarsal: at(
        0.35 + 0.55 * fold + 0.3 * lowerWidth,
        shape.lidThickness +
          0.2 * depth +
          shape.upperLidVolume * weight +
          lowerVolume,
        "pretarsalCrest",
        "tarsal",
      ),
      ridge: at(0.18, shape.lidThickness + 0.08, "margin", "margin"),
      inner: [point[0], point[1], point[2] + shape.lidThickness],
    };
  });
};
