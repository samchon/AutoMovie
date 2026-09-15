import type { IPortraitEyeShape } from "@automovie/human";

/**
 * Independent numerical eye input for admission and section arithmetic tests.
 * Each call owns its arrays and nested sampling settings. The dimensions are
 * round millimetre values inside the public input domain, with unit aperture
 * scales and zero socket translation. No photograph, fitted landmark set or
 * named person's tissue profile participates in this fixture.
 *
 * Full limbus and corneal contact make expression tests possible; a scenario
 * that exercises another mode must select it explicitly. A 16 mm globe can
 * support the small analytic apertures constructed by these tests. This input
 * alone does not provide a host, clinical anatomy or a complete face model.
 */
export const portraitEyeShapeFixture = (): IPortraitEyeShape => ({
  widthScale: 1,
  openingScale: 1,
  outerCornerLift: 0,
  socketLift: 0,
  blendReach: 8,
  foldWidth: 2,
  foldDepth: 0.4,
  upperLidVolume: 0.3,
  lowerLidWidth: 1,
  lowerLidVolume: 0.2,
  lidThickness: 0.1,
  surfaceRadius: 16,
  cornealRadius: 8,
  cornealThickness: 0.1,
  cornealRimLift: 0.3,
  cornealBoundary: "limbus",
  lidContact: "cornea",
  irisRadius: 5,
  pupilRadius: 2,
  browFibres: 0,
  upperLashes: 1,
  sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 8, irisRows: 3 },
});
