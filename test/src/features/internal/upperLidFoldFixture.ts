import type { IPortraitUpperLidProfile } from "@automovie/human/components/upperLidSection";

/** A hand-authored returning hood and its distinct unfolded closed target. */
export function upperLidFoldFixture(): IPortraitUpperLidProfile {
  const sections = [0, 1].map((at) => ({
    at,
    section: {
      margin: { offset: 0.2, projection: 0.1 },
      tarsal: { offset: 1, projection: 0.5 },
      creaseInner: { offset: 2, projection: 0 },
      creaseOuter: { offset: 2.5, projection: 0 },
      hood: { offset: 1.5, projection: 1 },
      preseptal: { offset: 4, projection: 0 },
      attachment: 5,
    },
  }));
  return {
    sections,
    closedSections: sections.map(({ at, section }) => ({
      at,
      section: {
        ...structuredClone(section),
        hood: { offset: 3, projection: 0.2 },
      },
    })),
  };
}
