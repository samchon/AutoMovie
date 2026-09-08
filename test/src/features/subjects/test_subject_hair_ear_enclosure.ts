import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { buildReferencePortrait } from "../../subjects/generated-korean-girl-01/model";

/**
 * A separately attached hidden ear belongs to the coarse hair envelope. Its
 * absence from the envelope previously left the helix outside the curtain.
 *
 * Scenarios:
 * 1. Build a coarse supporting head with resident ears and inspect every
 *    right-pinna vertex through the actual hair mesh's lateral depth sampler.
 *    Every sample has hair outside it in the anatomical-right profile.
 * 2. Translate the same ear 20 mm outward as a negative twin. The sampler must
 *    now detect uncovered points instead of passing an empty population.
 */
export const test_subject_hair_ear_enclosure = (): void => {
  const model = buildReferencePortrait({
    // This module boundary is head/ear/hair enclosure. Eye optics, dentition
    // and expression layers do not participate in the measured relationship.
    hairProxy: true,
    components: [],
    subdivisionRounds: 0,
  });
  const hair = model.parts.find((p) => p.id === "hair-mass");
  const ear = model.parts.find((p) => p.id === "right-pinna");
  if (hair?.geometry.type !== "mesh" || ear?.geometry.type !== "mesh")
    throw new Error("The subject needs resident hair and pinna meshes.");
  const sample = createAutoMovieMeshDepthSampler(hair.geometry.mesh, "x");
  let visible = 0,
    negative = 0;
  const points = ear.geometry.mesh.positions;
  TestValidator.predicate(
    "actual ear population is nonempty",
    points.length > 0,
  );
  for (let i = 0; i < points.length; i += 3) {
    const [x, y, z] = points.slice(i, i + 3),
      hit = sample(y, z);
    if (hit === null || hit.minimum > x) visible++;
    if (hit === null || hit.minimum > x - 0.02) negative++;
  }
  TestValidator.equals("hair encloses the hidden pinna", visible, 0);
  TestValidator.predicate(
    "outward ear escapes the same envelope",
    negative > 0,
  );
};
