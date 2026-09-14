/**
 * One fibre endpoint within the supporting brow and its signed lateral sweep.
 * A tip below its root allows an upper-band hair to converge with lower hairs.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates cross-brow hair direction from its skin attachment and geometric cost.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines a bounded brow-tip coordinate and signed anatomical lateral displacement.
 */
export interface IPortraitEyebrowFlowDirection {
  /** Tip across the brow: lower boundary zero, upper boundary one. */
  tip: number;
  /** Signed lateral bend in mm; positive points toward the anatomical tail. */
  outwardBend: number;
}

/**
 * Complete medial-to-lateral flow witnesses. Lower and upper describe the two
 * ends of the authored root band, independently of the hair's radius or count.
 * Interpolation across the root band permits convergence without adding fibres.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Authors distinct head, body and tail directions and upper/lower root-band convergence.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Orders two through 32 complete direction witnesses over anatomical progress zero to one.
 */
export interface IPortraitEyebrowFlowProfile {
  /** Strictly increasing complete witnesses, including medial zero and lateral one. */
  sections: readonly {
    at: number;
    lower: IPortraitEyebrowFlowDirection;
    upper: IPortraitEyebrowFlowDirection;
  }[];
}

/**
 * Own and interpolate one brow flow profile. Longitudinal cubic smoothstep and
 * linear root-band interpolation are convex, retaining bounded endpoint tips.
 * The query's root fraction is within the authored band, not the whole brow;
 * a collapsed band is sampled at one half by the fibre builder.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies the actual strand builder with independently authored longitudinal and cross-brow flow.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Validates finite complete witnesses and returns copied, bounded tip and signed sweep samples.
 */
export function createPortraitEyebrowFlow(input: IPortraitEyebrowFlowProfile) {
  const sections = structuredClone(input.sections);
  if (
    sections.length < 2 ||
    sections.length > 32 ||
    sections[0].at !== 0 ||
    sections[sections.length - 1].at !== 1 ||
    sections.some(
      (section, index) =>
        !Number.isFinite(section.at) ||
        (index > 0 && section.at <= sections[index - 1].at) ||
        [section.lower, section.upper].some(
          (direction) =>
            !Number.isFinite(direction.tip) ||
            direction.tip < 0 ||
            direction.tip > 1 ||
            !Number.isFinite(direction.outwardBend),
        ),
    )
  )
    throw new Error(
      "Eyebrow flow needs two through 32 ordered sections spanning zero to one, bounded tips and finite lateral sweeps.",
    );
  return (at: number, root: number): IPortraitEyebrowFlowDirection => {
    if (
      ![at, root].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1,
      )
    )
      throw new Error(
        "Eyebrow flow queries need longitudinal and root-band fractions in [0,1].",
      );
    let index = 0;
    while (index < sections.length - 2 && at > sections[index + 1].at) index++;
    const a = sections[index],
      b = sections[index + 1];
    const t = (at - a.at) / (b.at - a.at),
      weight = t * t * (3 - 2 * t);
    const value = (key: keyof IPortraitEyebrowFlowDirection): number => {
      const lower = a.lower[key] * (1 - weight) + b.lower[key] * weight;
      const upper = a.upper[key] * (1 - weight) + b.upper[key] * weight;
      return lower * (1 - root) + upper * root;
    };
    return { tip: value("tip"), outwardBend: value("outwardBend") };
  };
}
