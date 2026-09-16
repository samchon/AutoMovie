type Section<K extends string> = { attachment: number } & Record<
  K,
  { offset: number; projection: number }
>;

/**
 * The shared longitudinal calculation for named upper and lower tissue rows.
 * Both profiles use the same convex weights. Ordered sections preserve their
 * row order; an anatomical validator may instead admit a returning fold and
 * is then applied to every authored and interpolated section. Positive finite
 * offsets and an attachment outside all tissue remain common requirements.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Interpolates the named tissue stations used by both eyelid component profiles.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Owns copied section witnesses, common dimension bounds and default row ordering or explicit anatomical section validation under shared interpolation.
 */
export function createPortraitLidSectionSampler<K extends string>(
  input: readonly { at: number; section: Section<K> }[],
  roles: readonly [K, ...K[]],
  name: "Lower-lid" | "Upper-lid",
  validateSection?: (section: Section<K>) => void,
): (at: number) => Section<K> {
  const sections = structuredClone(input);
  const ownedRoles = [...roles];
  if (
    sections.length < 2 ||
    sections.length > 32 ||
    sections[0].at !== 0 ||
    sections[sections.length - 1].at !== 1
  )
    throw new Error(
      `${name} detail needs two through 32 sections spanning zero to one.`,
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
        `${name} section progress must be finite and strictly increasing.`,
      );
    let previous = 0;
    for (const role of ownedRoles) {
      const point = section[role];
      if (
        !Number.isFinite(point.offset) ||
        !Number.isFinite(point.projection) ||
        point.offset <= 0 ||
        (validateSection === undefined && point.offset <= previous)
      )
        throw new Error(
          `${name} tissue offsets must be finite, positive and strictly ordered.`,
        );
      previous = Math.max(previous, point.offset);
    }
    if (!Number.isFinite(section.attachment) || section.attachment <= previous)
      throw new Error(
        `${name} skin attachment must lie beyond its tissue section.`,
      );
    validateSection?.(section);
  }
  return (at) => {
    if (!Number.isFinite(at) || at < 0 || at > 1)
      throw new Error(
        `${name} sampling must stay in medial-to-lateral progress [0,1].`,
      );
    let index = 0;
    while (index < sections.length - 2 && at > sections[index + 1].at) index++;
    const left = sections[index],
      right = sections[index + 1];
    const t = (at - left.at) / (right.at - left.at),
      weight = t * t * (3 - 2 * t);
    const mix = (a: number, b: number) => a * (1 - weight) + b * weight;
    const section = {
      ...Object.fromEntries(
        ownedRoles.map((role) => [
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
    } as Section<K>;
    validateSection?.(section);
    return section;
  };
}
