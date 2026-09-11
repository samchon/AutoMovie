/**
 * A point in the lower lid's transverse section. Offset runs outward from the
 * aperture in its local image-plane normal; projection is signed anterior
 * relief over the common globe-to-skin depth bridge. Both use millimetres.
 * These describe visible tissue, not measured muscle thickness.
 * @author Samchon
 */
export interface IPortraitLowerLidPoint {
  /** Positive distance from the aperture, in millimetres. */
  offset: number;
  /** Signed anterior relief relative to the section's support bridge, in mm. */
  projection: number;
}

/**
 * A complete lower-lid section from its margin through pretarsal fullness and
 * the subtarsal boundary to preseptal skin. The attachment is a live skin query,
 * so its depth is owned by the host rather than supplied a second time here.
 * Internal sample positions increase strictly in the order listed below.
 * @author Samchon
 */
export interface IPortraitLowerLidSection {
  /** Narrow skin margin outside the wet opening. */
  margin: IPortraitLowerLidPoint;
  /** Crest of the pretarsal roll, distinct from optical contact displacement. */
  pretarsalCrest: IPortraitLowerLidPoint;
  /** Lower shoulder of the pretarsal body. */
  pretarsalLower: IPortraitLowerLidPoint;
  /** Inner side of the boundary below the pretarsal roll. */
  subtarsalInner: IPortraitLowerLidPoint;
  /** Outer side of that boundary, before the broader preseptal transition. */
  subtarsalOuter: IPortraitLowerLidPoint;
  /** Broader skin section beyond the pretarsal roll. */
  preseptal: IPortraitLowerLidPoint;
  /** Outer skin attachment distance, greater than every internal offset. */
  attachment: number;
}

/**
 * Optional longitudinal detail for one eye. Sections progress from anatomical
 * medial zero to lateral one, independently of the head-X ordering of an eye.
 * Omission is handled by the eye and retains its complete basic row formulas.
 * A supplied list replaces this detailed population and must span both ends.
 * The eye blends the detailed section into its basic canthi with a declared
 * sine weight; it does not add the new projections to the old lower roll.
 * @author Samchon
 */
export interface IPortraitLowerLidProfile {
  /** Two through 32 strictly ordered section witnesses, including zero and one. */
  sections: readonly {
    /** Medial-to-lateral progress in [0,1]. */
    at: number;
    /** Complete transverse tissue section at this progress. */
    section: IPortraitLowerLidSection;
  }[];
}

const roles = [
  "margin",
  "pretarsalCrest",
  "pretarsalLower",
  "subtarsalInner",
  "subtarsalOuter",
  "preseptal",
] as const;

/**
 * Own and interpolate the full lower-lid section. Cubic smoothstep between
 * witnesses keeps each scalar within its endpoints and gives zero longitudinal
 * derivative at a witness. Ordered offsets remain ordered under the same
 * convex weights, so a fold cannot cross its neighbouring tissue row.
 * The consumer still owns shared skin attachment, canthal fade and contact.
 */
export function createPortraitLowerLidProfile(
  input: IPortraitLowerLidProfile,
): (at: number) => IPortraitLowerLidSection {
  const sections = structuredClone(input.sections);
  if (
    sections.length < 2 ||
    sections.length > 32 ||
    sections[0].at !== 0 ||
    sections[sections.length - 1].at !== 1
  )
    throw new Error(
      "Lower-lid detail needs two through 32 sections spanning zero to one.",
    );
  for (let i = 0; i < sections.length; i++) {
    const { at, section } = sections[i];
    if (
      !Number.isFinite(at) ||
      at < 0 ||
      at > 1 ||
      (i !== 0 && at <= sections[i - 1].at)
    )
      throw new Error(
        "Lower-lid section progress must be finite and strictly increasing.",
      );
    let previous = 0;
    for (const role of roles) {
      const point = section[role];
      if (
        !Number.isFinite(point.offset) ||
        !Number.isFinite(point.projection) ||
        point.offset <= previous
      )
        throw new Error(
          "Lower-lid tissue offsets must be finite, positive and strictly ordered.",
        );
      previous = point.offset;
    }
    if (!Number.isFinite(section.attachment) || section.attachment <= previous)
      throw new Error(
        "Lower-lid skin attachment must lie beyond its tissue section.",
      );
  }
  return (at) => {
    if (!Number.isFinite(at) || at < 0 || at > 1)
      throw new Error(
        "Lower-lid sampling must stay in medial-to-lateral progress [0,1].",
      );
    let index = 0;
    while (index < sections.length - 2 && at > sections[index + 1].at) index++;
    const left = sections[index],
      right = sections[index + 1];
    const t = (at - left.at) / (right.at - left.at),
      weight = t * t * (3 - 2 * t);
    const mix = (a: number, b: number) => a * (1 - weight) + b * weight;
    return {
      ...Object.fromEntries(
        roles.map((role) => [
          role,
          {
            offset: mix(left.section[role].offset, right.section[role].offset),
            projection: mix(
              left.section[role].projection,
              right.section[role].projection,
            ),
          },
        ]),
      ),
      attachment: mix(left.section.attachment, right.section.attachment),
    } as IPortraitLowerLidSection;
  };
}
